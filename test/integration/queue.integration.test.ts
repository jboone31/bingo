import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getSql, withTransaction } from "@/lib/db/server";
import { insertSeedQueue } from "@/lib/dev/seedQueue";
import {
  deleteQueueItem,
  getQueueIds,
  insertQueueItem,
  lockMemberForQueue,
  rewriteOrder,
  submissionInLeague,
} from "@/lib/queue/queries";
import {
  addMember,
  asRole,
  cleanup,
  createLeague,
  createUser,
  hasDb,
} from "./helpers";

/** Live checks for queue_items, its triggers, RLS, pool_categories and the queries. */

describe.skipIf(!hasDb)("queue", { timeout: 60_000 }, () => {
  let admin: string;
  let member: string;
  let stranger: string;
  let league: string;
  let sub: string[];

  const makeSubmissions = async (leagueId: string, n: number) => {
    const rows = await getSql()`
      insert into public.submissions (league_id, text)
      select ${leagueId}, 'Square ' || g from generate_series(1, ${n}::int) g
      returning id`;
    return rows.map((r) => r.id as string);
  };
  const queueRows = (leagueId: string, userId: string) =>
    getSql()`select submission_id, position from public.queue_items
              where league_id = ${leagueId} and user_id = ${userId}
              order by position`;
  const put = (
    leagueId: string,
    userId: string,
    submissionId: string,
    position: number,
  ) =>
    getSql()`insert into public.queue_items (league_id, user_id, submission_id, position)
             values (${leagueId}, ${userId}, ${submissionId}, ${position})`;

  beforeAll(async () => {
    admin = await createUser({ full_name: "Q Admin" });
    member = await createUser({ full_name: "Q Member" });
    stranger = await createUser({ full_name: "Q Stranger" });
    league = await createLeague(admin);
    await addMember(league, member);
    sub = await makeSubmissions(league, 5);
  });

  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  describe("reads (RLS)", () => {
    it("the owner reads their queue; nobody else does, not even the admin", async () => {
      await put(league, member, sub[0], 1);
      const own = await asRole("authenticated", member, (tx) => {
        return tx`select submission_id from public.queue_items where league_id = ${league}`;
      });
      expect(own.map((r) => r.submission_id)).toEqual([sub[0]]);
      for (const other of [admin, stranger]) {
        const rows = await asRole("authenticated", other, (tx) => {
          return tx`select 1 from public.queue_items where league_id = ${league}`;
        });
        expect(rows).toHaveLength(0);
      }
      const anon = await asRole("anon", null, (tx) => {
        return tx`select 1 from public.queue_items`.catch(() => []);
      });
      expect(anon).toHaveLength(0);
      await getSql()`delete from public.queue_items where league_id = ${league}`;
    });

    it.each([
      [
        "insert",
        (tx: ReturnType<typeof getSql>, s: string) =>
          tx`insert into public.queue_items (league_id, user_id, submission_id, position)
           values (${league}, ${member}, ${s}, 1)`,
      ],
      [
        "update",
        (tx: ReturnType<typeof getSql>) =>
          tx`update public.queue_items set position = 9 where league_id = ${league}`,
      ],
      [
        "delete",
        (tx: ReturnType<typeof getSql>) =>
          tx`delete from public.queue_items where league_id = ${league}`,
      ],
    ])("a direct %s by the owner has no effect", async (_label, run) => {
      await put(league, member, sub[0], 1);
      const changed = await asRole("authenticated", member, async (tx) => {
        return (await run(tx, sub[1])).count;
      }).catch(() => 0);
      expect(changed).toBe(0);
      const rows = await queueRows(league, member);
      expect(rows.map((r) => [r.submission_id, r.position])).toEqual([
        [sub[0], 1],
      ]);
      await getSql()`delete from public.queue_items where league_id = ${league}`;
    });
  });

  describe("constraints and triggers", () => {
    it("rejects a submission from another league", async () => {
      const other = await createLeague(admin);
      const [foreign] = await makeSubmissions(other, 1);
      await expect(put(league, member, foreign, 1)).rejects.toThrow();
    });

    it("rejects a user who is not a member", async () => {
      await expect(put(league, stranger, sub[0], 1)).rejects.toThrow();
    });

    it("rejects the same square twice and the same position twice", async () => {
      await put(league, member, sub[0], 1);
      await expect(put(league, member, sub[0], 2)).rejects.toThrow();
      await expect(put(league, member, sub[1], 1)).rejects.toThrow();
      await getSql()`delete from public.queue_items where league_id = ${league}`;
    });

    it("lets two members queue the same square", async () => {
      await put(league, member, sub[0], 1);
      await put(league, admin, sub[0], 1);
      await getSql()`delete from public.queue_items where league_id = ${league}`;
    });

    it("only the position may change", async () => {
      await put(league, member, sub[0], 1);
      await expect(
        getSql()`update public.queue_items set submission_id = ${sub[1]}
                 where league_id = ${league} and user_id = ${member}`,
      ).rejects.toThrow(/queue_item_immutable/);
      await getSql()`delete from public.queue_items where league_id = ${league}`;
    });

    it("accepts exactly 200 items and refuses the 201st", async () => {
      const l = await createLeague(admin);
      const ids = await makeSubmissions(l, 201);
      const sql = getSql();
      await sql`insert into public.queue_items (league_id, user_id, submission_id, position)
                select ${l}, ${admin}, s, row_number() over ()
                from unnest(${ids.slice(0, 200)}::uuid[]) as s`;
      await expect(put(l, admin, ids[200], 201)).rejects.toThrow(/queue_full/);
    }, 120_000);

    it("allows changes while drafting (F7), refuses them once in progress, and lets the league be deleted", async () => {
      const l = await createLeague(admin);
      await addMember(l, member);
      const ids = await makeSubmissions(l, 3);
      await put(l, member, ids[0], 1);
      await getSql()`update public.leagues set status = 'drafting' where id = ${l}`;
      await put(l, member, ids[2], 3);
      await getSql()`delete from public.queue_items
                      where league_id = ${l} and submission_id = ${ids[2]}`;
      await getSql()`update public.leagues set status = 'in_progress' where id = ${l}`;
      await expect(put(l, member, ids[1], 2)).rejects.toThrow(
        /league_not_pre_draft/,
      );
      await expect(
        getSql()`update public.queue_items set position = 5 where league_id = ${l}`,
      ).rejects.toThrow(/league_not_pre_draft/);
      await expect(
        getSql()`delete from public.queue_items where league_id = ${l}`,
      ).rejects.toThrow(/league_not_pre_draft/);
      await getSql()`delete from public.leagues where id = ${l}`;
      const left =
        await getSql()`select 1 from public.queue_items where league_id = ${l}`;
      expect(left).toHaveLength(0);
    });
  });

  describe("cascades", () => {
    it("deleting a submission removes it from every queue", async () => {
      const l = await createLeague(admin);
      await addMember(l, member);
      const ids = await makeSubmissions(l, 2);
      await put(l, member, ids[0], 1);
      await put(l, admin, ids[0], 1);
      await getSql()`delete from public.submissions where id = ${ids[0]}`;
      const rows =
        await getSql()`select 1 from public.queue_items where league_id = ${l}`;
      expect(rows).toHaveLength(0);
    });

    it("removing a member removes their queue and no one else's", async () => {
      const l = await createLeague(admin);
      await addMember(l, member);
      const ids = await makeSubmissions(l, 1);
      await put(l, member, ids[0], 1);
      await put(l, admin, ids[0], 1);
      await getSql()`delete from public.league_members where league_id = ${l} and user_id = ${member}`;
      expect(await queueRows(l, member)).toHaveLength(0);
      expect(await queueRows(l, admin)).toHaveLength(1);
    });
  });

  describe("pool_categories view", () => {
    it("groups ignoring case, counts, and respects membership", async () => {
      const l = await createLeague(admin);
      await addMember(l, member);
      await getSql()`
        insert into public.submissions (league_id, text, category) values
          (${l}, 'a', 'Sports'), (${l}, 'b', 'sports'), (${l}, 'c', 'SPORTS'),
          (${l}, 'd', 'Movies'), (${l}, 'e', '')`;
      const asMember = await asRole("authenticated", member, (tx) => {
        return tx`select key, label, count from public.pool_categories
                  where league_id = ${l} order by key`;
      });
      expect(asMember.map((r) => [r.key, r.count])).toEqual([
        ["", 1],
        ["movies", 1],
        ["sports", 3],
      ]);
      const asStranger = await asRole("authenticated", stranger, (tx) => {
        return tx`select 1 from public.pool_categories where league_id = ${l}`;
      });
      expect(asStranger).toHaveLength(0);
    });
  });

  describe("query functions", () => {
    it("locks only for a member, and reports the league status", async () => {
      expect(
        await withTransaction((tx) => lockMemberForQueue(tx, league, member)),
      ).toBe("pre_draft");
      expect(
        await withTransaction((tx) => lockMemberForQueue(tx, league, stranger)),
      ).toBeNull();
      expect(
        await withTransaction((tx) =>
          lockMemberForQueue(tx, randomUUID(), member),
        ),
      ).toBeNull();
    });

    it("adds to the end, ignores repeats, and removes quietly", async () => {
      const l = await createLeague(admin);
      const ids = await makeSubmissions(l, 3);
      const add = (id: string) =>
        withTransaction((tx) => insertQueueItem(tx, l, admin, id));
      expect(await add(ids[2])).toBe(true);
      expect(await add(ids[0])).toBe(true);
      expect(await add(ids[2])).toBe(false);
      expect(await withTransaction((tx) => getQueueIds(tx, l, admin))).toEqual([
        ids[2],
        ids[0],
      ]);
      await withTransaction((tx) => deleteQueueItem(tx, l, admin, ids[2]));
      await withTransaction((tx) => deleteQueueItem(tx, l, admin, ids[2]));
      expect(await withTransaction((tx) => getQueueIds(tx, l, admin))).toEqual([
        ids[0],
      ]);
      // A new add goes after the highest position, even with gaps from removals.
      await add(ids[1]);
      expect(await withTransaction((tx) => getQueueIds(tx, l, admin))).toEqual([
        ids[0],
        ids[1],
      ]);
    });

    it("rewrites the whole order in one transaction", async () => {
      const l = await createLeague(admin);
      const ids = await makeSubmissions(l, 5);
      for (const id of ids) {
        await withTransaction((tx) => insertQueueItem(tx, l, admin, id));
      }
      const reversed = [...ids].reverse();
      await withTransaction((tx) => rewriteOrder(tx, l, admin, reversed));
      expect(await withTransaction((tx) => getQueueIds(tx, l, admin))).toEqual(
        reversed,
      );
      const rows = await queueRows(l, admin);
      expect(rows.map((r) => r.position)).toEqual([1, 2, 3, 4, 5]);
    });

    it("rewriteOrder only touches the caller's own queue", async () => {
      const l = await createLeague(admin);
      await addMember(l, member);
      const ids = await makeSubmissions(l, 2);
      for (const id of ids) {
        await withTransaction((tx) => insertQueueItem(tx, l, admin, id));
        await withTransaction((tx) => insertQueueItem(tx, l, member, id));
      }
      await withTransaction((tx) =>
        rewriteOrder(tx, l, admin, [ids[1], ids[0]]),
      );
      expect(await withTransaction((tx) => getQueueIds(tx, l, member))).toEqual(
        ids,
      );
    });

    it("knows whether a submission is in the league", async () => {
      const other = await createLeague(admin);
      const [foreign] = await makeSubmissions(other, 1);
      expect(
        await withTransaction((tx) => submissionInLeague(tx, league, sub[0])),
      ).toBe(true);
      expect(
        await withTransaction((tx) => submissionInLeague(tx, league, foreign)),
      ).toBe(false);
    });
  });
});

describe.skipIf(!hasDb)("seed queue helper", { timeout: 60_000 }, () => {
  let admin: string;
  let member: string;

  beforeAll(async () => {
    admin = await createUser({ full_name: "Seed Q Admin" });
    member = await createUser({ full_name: "Seed Q Member" });
  });

  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  it("builds a queue in the given order through the real table", async () => {
    const l = await createLeague(admin);
    await addMember(l, member);
    const rows = await getSql()`
      insert into public.submissions (league_id, text)
      select ${l}, 'S' || g from generate_series(1, 6) g returning id`;
    const ids = rows.map((r) => r.id as string);
    const order = [ids[3], ids[0], ids[5]];
    await withTransaction((tx) => insertSeedQueue(tx, l, member, order));
    expect(await withTransaction((tx) => getQueueIds(tx, l, member))).toEqual(
      order,
    );
    await withTransaction((tx) => insertSeedQueue(tx, l, admin, []));
    expect(await withTransaction((tx) => getQueueIds(tx, l, admin))).toEqual(
      [],
    );
  });
});
