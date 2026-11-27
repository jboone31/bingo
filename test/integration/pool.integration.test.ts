import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getSql, withTransaction } from "@/lib/db/server";
import {
  countSubmissions,
  deleteAllSubmissions,
  deleteSubmission,
  firstSubmissionOfImport,
  insertSubmissions,
  recordImport,
  updateSubmission,
} from "@/lib/pool/queries";
import { asRole, cleanup, createLeague, createUser, hasDb } from "./helpers";

/** Live checks for submissions, their triggers, RLS, and the pool queries. */

describe.skipIf(!hasDb)("pool", { timeout: 60_000 }, () => {
  let admin: string;
  let member: string;
  let stranger: string;
  let league: string;

  const insert = (leagueId: string, text: string, extra = "") =>
    getSql().unsafe(
      `insert into public.submissions (league_id, text ${extra ? ", " + extra.split("=")[0] : ""})
       values ('${leagueId}', '${text}' ${extra ? ", '" + extra.split("=")[1] + "'" : ""}) returning id`,
    );

  beforeAll(async () => {
    admin = await createUser({ full_name: "Pool Admin" });
    member = await createUser({ full_name: "Pool Member" });
    stranger = await createUser({ full_name: "Pool Stranger" });
    league = await createLeague(admin);
    await getSql()`
      insert into public.league_members (league_id, user_id) values (${league}, ${member})`;
  });

  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  describe("reads and writes through RLS", () => {
    it("members read the pool; non-members and anon do not", async () => {
      await insert(league, "Readable");
      const asMember = await asRole("authenticated", member, (tx) => {
        return tx`select text from public.submissions where league_id = ${league}`;
      });
      expect(asMember.map((r) => r.text)).toContain("Readable");
      const asStranger = await asRole("authenticated", stranger, (tx) => {
        return tx`select text from public.submissions where league_id = ${league}`;
      });
      expect(asStranger).toHaveLength(0);
      const asAnon = await asRole("anon", null, (tx) => {
        return tx`select text from public.submissions`.catch(() => []);
      });
      expect(asAnon).toHaveLength(0);
    });

    it.each([
      [
        "insert",
        (tx: ReturnType<typeof getSql>) =>
          tx`insert into public.submissions (league_id, text) values (${league}, 'x')`,
      ],
      [
        "update",
        (tx: ReturnType<typeof getSql>) =>
          tx`update public.submissions set text = 'Hacked' where league_id = ${league}`,
      ],
      [
        "delete",
        (tx: ReturnType<typeof getSql>) =>
          tx`delete from public.submissions where league_id = ${league}`,
      ],
    ])("a member's direct %s has no effect", async (_label, run) => {
      const changed = await asRole("authenticated", member, async (tx) => {
        return (await run(tx)).count;
      }).catch(() => 0);
      expect(changed).toBe(0);
      const hacked = await getSql()`
        select 1 from public.submissions where text = 'Hacked' or text = 'x'`;
      expect(hacked).toHaveLength(0);
    });

    it("submission_imports is not readable by users", async () => {
      const rows = await asRole("authenticated", admin, (tx) => {
        return tx`select 1 from public.submission_imports`.catch(() => []);
      });
      expect(rows).toHaveLength(0);
    });
  });

  describe("constraints", () => {
    it("allows duplicate text and gives each row its own id", async () => {
      const l = await createLeague(admin);
      const a = await insert(l, "Same square");
      const b = await insert(l, "Same square");
      expect(a[0].id).not.toBe(b[0].id);
    });

    it("rejects over-long, untrimmed and empty values", async () => {
      const l = await createLeague(admin);
      const sql = getSql();
      await expect(
        sql`insert into public.submissions (league_id, text) values (${l}, ${"x".repeat(201)})`,
      ).rejects.toThrow();
      await expect(
        sql`insert into public.submissions (league_id, text) values (${l}, ' padded ')`,
      ).rejects.toThrow();
      await expect(
        sql`insert into public.submissions (league_id, text) values (${l}, '')`,
      ).rejects.toThrow();
      await expect(
        sql`insert into public.submissions (league_id, text, submitter) values (${l}, 'ok', ${"s".repeat(61)})`,
      ).rejects.toThrow();
      await expect(
        sql`insert into public.submissions (league_id, text, category) values (${l}, 'ok', ${"c".repeat(41)})`,
      ).rejects.toThrow();
    });

    it("records a request id only once per league", async () => {
      const l = await createLeague(admin);
      const requestId = randomUUID();
      await getSql()`insert into public.submission_imports (league_id, request_id, row_count) values (${l}, ${requestId}, 1)`;
      await expect(
        getSql()`insert into public.submission_imports (league_id, request_id, row_count) values (${l}, ${requestId}, 1)`,
      ).rejects.toThrow();
    });

    it("a row's league and id cannot change", async () => {
      const l1 = await createLeague(admin);
      const l2 = await createLeague(admin);
      const [{ id }] = await insert(l1, "Stays put");
      await expect(
        getSql()`update public.submissions set league_id = ${l2} where id = ${id}`,
      ).rejects.toThrow(/submission_immutable/);
    });
  });

  describe("guard trigger", () => {
    it("refuses insert, update and delete once the league has started", async () => {
      const l = await createLeague(admin);
      const [{ id }] = await insert(l, "Before the start");
      await getSql()`update public.leagues set status = 'drafting' where id = ${l}`;
      await expect(insert(l, "Too late")).rejects.toThrow(
        /league_not_pre_draft/,
      );
      await expect(
        getSql()`update public.submissions set text = 'Changed' where id = ${id}`,
      ).rejects.toThrow(/league_not_pre_draft/);
      await expect(
        getSql()`delete from public.submissions where id = ${id}`,
      ).rejects.toThrow(/league_not_pre_draft/);
    });

    it("still lets a league and its pool be deleted together", async () => {
      const l = await createLeague(admin);
      await insert(l, "Goes with the league");
      await getSql()`update public.leagues set status = 'drafting' where id = ${l}`;
      await getSql()`delete from public.leagues where id = ${l}`;
      const rows =
        await getSql()`select 1 from public.submissions where league_id = ${l}`;
      expect(rows).toHaveLength(0);
    });
  });

  describe("cap trigger", () => {
    it("accepts exactly 5,000 rows and refuses one more", async () => {
      const l = await createLeague(admin);
      const sql = getSql();
      await sql`
        insert into public.submissions (league_id, text)
        select ${l}, 'Row ' || g from generate_series(1, 5000) as g`;
      const [{ n }] =
        await sql`select count(*)::int as n from public.submissions where league_id = ${l}`;
      expect(n).toBe(5000);
      await expect(insert(l, "One too many")).rejects.toThrow(/pool_full/);
    }, 120_000);

    it("refuses a bulk insert that crosses the cap, leaving nothing behind", async () => {
      const l = await createLeague(admin);
      const sql = getSql();
      await expect(
        sql`insert into public.submissions (league_id, text)
            select ${l}, 'Row ' || g from generate_series(1, 5001) as g`,
      ).rejects.toThrow(/pool_full/);
      const [{ n }] =
        await sql`select count(*)::int as n from public.submissions where league_id = ${l}`;
      expect(n).toBe(0);
    }, 120_000);
  });

  describe("query functions", () => {
    it("records an import once and returns the earlier record on a repeat", async () => {
      const l = await createLeague(admin);
      const requestId = randomUUID();
      const first = await withTransaction((tx) =>
        recordImport(tx, l, requestId, 3),
      );
      expect(first.existing).toBe(false);
      const again = await withTransaction((tx) =>
        recordImport(tx, l, requestId, 3),
      );
      expect(again).toEqual({
        importId: first.importId,
        existing: true,
        rowCount: 3,
      });
    });

    it("bulk insert keeps file order in seq and allows duplicates", async () => {
      const l = await createLeague(admin);
      const rows = [
        { text: "B", submitter: "Sam", category: "X" },
        { text: "A", submitter: "", category: "" },
        { text: "B", submitter: "Sam", category: "X" },
      ];
      await withTransaction(async (tx) => {
        const record = await recordImport(tx, l, randomUUID(), rows.length);
        await insertSubmissions(tx, l, record.importId, rows);
      });
      const stored = await getSql()`
        select text, submitter, category from public.submissions
         where league_id = ${l} order by seq`;
      expect(stored.map((r) => r.text)).toEqual(["B", "A", "B"]);
      expect(stored[0]).toMatchObject({ submitter: "Sam", category: "X" });
      expect(await withTransaction((tx) => countSubmissions(tx, l))).toBe(3);
    });

    it("finds the first row of an import, or null once it is deleted", async () => {
      const l = await createLeague(admin);
      const record = await withTransaction((tx) =>
        recordImport(tx, l, randomUUID(), 1),
      );
      const [id] = await withTransaction((tx) =>
        insertSubmissions(tx, l, record.importId, [
          { text: "Only", submitter: "", category: "" },
        ]),
      );
      expect(
        await withTransaction((tx) =>
          firstSubmissionOfImport(tx, record.importId),
        ),
      ).toBe(id);
      await withTransaction((tx) => deleteSubmission(tx, l, id));
      expect(
        await withTransaction((tx) =>
          firstSubmissionOfImport(tx, record.importId),
        ),
      ).toBeNull();
    });

    it("updates only the given fields and only inside the league", async () => {
      const l1 = await createLeague(admin);
      const l2 = await createLeague(admin);
      const rec = await withTransaction((tx) =>
        recordImport(tx, l1, randomUUID(), 1),
      );
      const [id] = await withTransaction((tx) =>
        insertSubmissions(tx, l1, rec.importId, [
          { text: "Original", submitter: "Sam", category: "X" },
        ]),
      );
      expect(
        await withTransaction((tx) =>
          updateSubmission(tx, l1, id, { category: "Y" }),
        ),
      ).toBe("updated");
      // The same values again change nothing.
      expect(
        await withTransaction((tx) =>
          updateSubmission(tx, l1, id, { category: "Y", text: "Original" }),
        ),
      ).toBe("unchanged");
      const [row] =
        await getSql()`select text, submitter, category from public.submissions where id = ${id}`;
      expect(row).toMatchObject({
        text: "Original",
        submitter: "Sam",
        category: "Y",
      });
      // Wrong league: no such row there.
      expect(
        await withTransaction((tx) =>
          updateSubmission(tx, l2, id, { text: "Hijack" }),
        ),
      ).toBe("missing");
      const [after] =
        await getSql()`select text from public.submissions where id = ${id}`;
      expect(after.text).toBe("Original");
    });

    it("deletes one row quietly when it is already gone, and clears all", async () => {
      const l = await createLeague(admin);
      const rec = await withTransaction((tx) =>
        recordImport(tx, l, randomUUID(), 3),
      );
      const ids = await withTransaction((tx) =>
        insertSubmissions(
          tx,
          l,
          rec.importId,
          ["a", "b", "c"].map((text) => ({
            text,
            submitter: "",
            category: "",
          })),
        ),
      );
      expect(
        await withTransaction((tx) => deleteSubmission(tx, l, ids[0])),
      ).toBe(true);
      expect(
        await withTransaction((tx) => deleteSubmission(tx, l, ids[0])),
      ).toBe(false);
      expect(await withTransaction((tx) => countSubmissions(tx, l))).toBe(2);
      expect(await withTransaction((tx) => deleteAllSubmissions(tx, l))).toBe(
        2,
      );
      expect(await withTransaction((tx) => deleteAllSubmissions(tx, l))).toBe(
        0,
      );
    });
  });
});
