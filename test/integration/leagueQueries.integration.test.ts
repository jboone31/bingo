import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getSql, withTransaction } from "@/lib/db/server";
import {
  countMembers,
  createLeague,
  deleteLeague,
  deleteMember,
  getMemberRole,
  insertMember,
  lockLeagueByCode,
  lockLeagueById,
  setJoinCode,
  setRole,
} from "@/lib/leagues/queries";
import { cleanup, createUser, hasDb } from "./helpers";

/** The SQL in lib/leagues/queries.ts, run against the live database. */

describe.skipIf(!hasDb)("league queries", () => {
  let admin: string;
  let other: string;

  beforeAll(async () => {
    admin = await createUser({ full_name: "Q Admin" });
    other = await createUser({ full_name: "Q Other" });
  });

  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  it("creates a league with an admin member and a valid code", async () => {
    const requestId = randomUUID();
    const result = await withTransaction((tx) =>
      createLeague(tx, {
        name: "Query League",
        draftAt: "2026-03-01T19:00:00.000Z",
        userId: admin,
        requestId,
      }),
    );
    expect(result.created).toBe(true);
    const league = await withTransaction((tx) => lockLeagueById(tx, result.id));
    expect(league).toMatchObject({
      name: "Query League",
      status: "pre_draft",
      draftAt: "2026-03-01T19:00:00.000Z",
    });
    expect(league?.joinCode).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    expect(
      await withTransaction((tx) => getMemberRole(tx, result.id, admin)),
    ).toBe("admin");
  });

  it("returns the same league for a repeated request id", async () => {
    const requestId = randomUUID();
    const input = { name: "Twice", draftAt: null, userId: admin, requestId };
    const first = await withTransaction((tx) => createLeague(tx, input));
    const second = await withTransaction((tx) => createLeague(tx, input));
    expect(second).toEqual({ id: first.id, created: false });
    const rows = await getSql()`
      select count(*)::int as n from public.leagues
      where created_by = ${admin} and create_key = ${requestId}`;
    expect(rows[0].n).toBe(1);
  });

  it("joins, counts, finds by code, regenerates the code, and removes", async () => {
    const { id } = await withTransaction((tx) =>
      createLeague(tx, {
        name: "Flow",
        draftAt: null,
        userId: admin,
        requestId: randomUUID(),
      }),
    );
    const before = await withTransaction((tx) => lockLeagueById(tx, id));
    const byCode = await withTransaction((tx) =>
      lockLeagueByCode(tx, before!.joinCode),
    );
    expect(byCode?.id).toBe(id);

    await withTransaction((tx) => insertMember(tx, id, other, "member"));
    expect(await withTransaction((tx) => countMembers(tx, id))).toBe(2);

    const newCode = await withTransaction((tx) => setJoinCode(tx, id));
    expect(newCode).not.toBe(before!.joinCode);
    expect(
      await withTransaction((tx) => lockLeagueByCode(tx, before!.joinCode)),
    ).toBeNull();
    expect(
      (await withTransaction((tx) => lockLeagueByCode(tx, newCode)))?.id,
    ).toBe(id);

    await withTransaction((tx) => deleteMember(tx, id, other));
    expect(
      await withTransaction((tx) => getMemberRole(tx, id, other)),
    ).toBeNull();
  });

  it("transfers admin by demoting first, then promoting", async () => {
    const { id } = await withTransaction((tx) =>
      createLeague(tx, {
        name: "Transfer",
        draftAt: null,
        userId: admin,
        requestId: randomUUID(),
      }),
    );
    await withTransaction((tx) => insertMember(tx, id, other, "member"));
    await withTransaction(async (tx) => {
      await setRole(tx, id, admin, "member");
      await setRole(tx, id, other, "admin");
    });
    expect(await withTransaction((tx) => getMemberRole(tx, id, other))).toBe(
      "admin",
    );
    expect(await withTransaction((tx) => getMemberRole(tx, id, admin))).toBe(
      "member",
    );
  });

  it("deletes the league and its members", async () => {
    const { id } = await withTransaction((tx) =>
      createLeague(tx, {
        name: "Gone",
        draftAt: null,
        userId: admin,
        requestId: randomUUID(),
      }),
    );
    await withTransaction((tx) => deleteLeague(tx, id));
    expect(await withTransaction((tx) => lockLeagueById(tx, id))).toBeNull();
    const rows =
      await getSql()`select 1 from public.league_members where league_id = ${id}`;
    expect(rows).toHaveLength(0);
  });
});
