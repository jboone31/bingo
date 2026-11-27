import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getSql, withTransaction } from "@/lib/db/server";
import { setDraftSettings } from "@/lib/draft/queries";
import { startDraft } from "@/lib/draft/start";
import {
  addMember,
  asRole,
  cleanup,
  createLeague,
  createUser,
  hasDb,
} from "./helpers";

/** Live checks for draft settings, the start, and the group tables. */
describe.skipIf(!hasDb)("draft setup", { timeout: 120_000 }, () => {
  let admin: string;
  let players: string[];
  let stranger: string;

  const addPool = (leagueId: string, n: number) =>
    getSql()`insert into public.submissions (league_id, text)
             select ${leagueId}, 'Square ' || g from generate_series(1, ${n}::int) g`;

  /** A pre-draft league with the admin plus `extra` players and `pool` squares. */
  async function league(extra: number, pool: number, groups = 1) {
    const id = await createLeague(admin);
    for (const p of players.slice(0, extra)) await addMember(id, p);
    if (pool > 0) await addPool(id, pool);
    if (groups !== 1) {
      await getSql()`update public.leagues set group_count = ${groups} where id = ${id}`;
    }
    return id;
  }

  const groupRows = (leagueId: string) =>
    getSql()`select g.number, m.user_id, m.position
               from public.draft_group_members m
               join public.draft_groups g on g.id = m.group_id
              where m.league_id = ${leagueId}
              order by g.number, m.position`;

  beforeAll(async () => {
    admin = await createUser({ full_name: "D Admin" });
    players = [];
    for (let i = 0; i < 6; i += 1) {
      players.push(await createUser({ full_name: `D Player ${i}` }));
    }
    stranger = await createUser({ full_name: "D Stranger" });
  });

  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  it("saves settings and reports whether they changed", async () => {
    const id = await league(0, 0);
    const save = (s: { groupCount?: number; pickSeconds?: number }) =>
      withTransaction((tx) => setDraftSettings(tx, id, s));
    expect(await save({ groupCount: 3 })).toBe(true);
    expect(await save({ groupCount: 3 })).toBe(false);
    expect(await save({ pickSeconds: 900 })).toBe(true);
    expect(await save({ groupCount: 3, pickSeconds: 900 })).toBe(false);
    const [row] = await getSql()`
      select group_count, pick_seconds from public.leagues where id = ${id}`;
    expect(row).toEqual({ group_count: 3, pick_seconds: 900 });
    await expect(save({ pickSeconds: 901 })).rejects.toThrow();
    await expect(save({ groupCount: 0 })).rejects.toThrow();
  });

  it("starts: drafting, a start time, balanced groups, an order and an event", async () => {
    // Admin + 6 players = 7 in 3 groups: sizes 3, 2, 2. Needs ceil(7/3) * 25 = 75.
    const id = await league(6, 75, 3);
    const result = await withTransaction((tx) =>
      startDraft(tx, id, admin, { members: 7, groupCount: 3 }),
    );
    expect(result).toEqual({ alreadyStarted: false });

    const [lg] = await getSql()`
      select status, draft_started_at from public.leagues where id = ${id}`;
    expect(lg.status).toBe("drafting");
    expect(lg.draft_started_at).not.toBeNull();

    const rows = await groupRows(id);
    expect(rows).toHaveLength(7);
    const sizes = [1, 2, 3].map(
      (n) => rows.filter((r) => r.number === n).length,
    );
    expect(sizes).toEqual([3, 2, 2]);
    expect(new Set(rows.map((r) => r.user_id))).toEqual(
      new Set([admin, ...players]),
    );
    for (const n of [1, 2, 3]) {
      const positions = rows
        .filter((r) => r.number === n)
        .map((r) => r.position);
      expect(positions).toEqual(positions.map((_, i) => i + 1));
    }

    const events = await getSql()`
      select type, payload from public.league_events
       where league_id = ${id} and type = 'draft_started'`;
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ groupCount: 3, sizes: [3, 2, 2] });
  });

  it("treats a repeat as already started and changes nothing", async () => {
    const id = await league(1, 50);
    await withTransaction((tx) =>
      startDraft(tx, id, admin, { members: 2, groupCount: 1 }),
    );
    const before = await groupRows(id);
    const again = await withTransaction((tx) =>
      startDraft(tx, id, admin, { members: 2, groupCount: 1 }),
    );
    expect(again).toEqual({ alreadyStarted: true });
    expect(await groupRows(id)).toEqual(before);
    const [{ n }] = await getSql()`
      select count(*)::int as n from public.league_events
       where league_id = ${id} and type = 'draft_started'`;
    expect(n).toBe(1);
  });

  it("refuses a short pool and leaves the league untouched", async () => {
    const id = await league(1, 49, 1); // needs 50
    await expect(
      withTransaction((tx) =>
        startDraft(tx, id, admin, { members: 2, groupCount: 1 }),
      ),
    ).rejects.toMatchObject({ reason: "pool_too_small" });
    const [lg] =
      await getSql()`select status from public.leagues where id = ${id}`;
    expect(lg.status).toBe("pre_draft");
    expect(await groupRows(id)).toHaveLength(0);
  });

  it("refuses settings changes and group edits after the start", async () => {
    const id = await league(1, 50);
    await withTransaction((tx) =>
      startDraft(tx, id, admin, { members: 2, groupCount: 1 }),
    );
    await expect(
      getSql()`update public.leagues set pick_seconds = 30 where id = ${id}`,
    ).rejects.toThrow(/league_not_pre_draft/);
    await expect(
      getSql()`update public.leagues set group_count = 2 where id = ${id}`,
    ).rejects.toThrow(/league_not_pre_draft/);
    // Other league updates still work (the event counter, for one).
    await getSql()`update public.leagues set name = 'Renamed' where id = ${id}`;
    await expect(
      getSql()`update public.draft_group_members set position = 9 where league_id = ${id}`,
    ).rejects.toThrow(/draft_groups_immutable/);
    await expect(
      getSql()`delete from public.draft_groups where league_id = ${id}`,
    ).rejects.toThrow(/draft_groups_immutable/);
  });

  it("refuses group rows while pre_draft", async () => {
    const id = await league(0, 0);
    await expect(
      getSql()`insert into public.draft_groups (league_id, number) values (${id}, 1)`,
    ).rejects.toThrow(/league_not_drafting/);
  });

  it("lets members read groups, hides them from others, and refuses client writes", async () => {
    const id = await league(1, 50);
    await withTransaction((tx) =>
      startDraft(tx, id, admin, { members: 2, groupCount: 1 }),
    );
    const member = players[0];
    const seen = await asRole(
      "authenticated",
      member,
      (tx) =>
        tx`select user_id from public.draft_group_members where league_id = ${id}`,
    );
    expect(seen).toHaveLength(2);
    const groups = await asRole(
      "authenticated",
      member,
      (tx) =>
        tx`select number from public.draft_groups where league_id = ${id}`,
    );
    expect(groups).toHaveLength(1);
    const hidden = await asRole(
      "authenticated",
      stranger,
      (tx) =>
        tx`select 1 from public.draft_group_members where league_id = ${id}`,
    );
    expect(hidden).toHaveLength(0);
    await expect(
      asRole(
        "authenticated",
        admin,
        (tx) =>
          tx`insert into public.draft_groups (league_id, number) values (${id}, 2)`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole("anon", null, (tx) => tx`select 1 from public.draft_groups`),
    ).rejects.toThrow(/permission denied/);
  });

  it("removes groups with the league, and lets a deleted account leave its group", async () => {
    const temp = await createUser({ full_name: "D Temp" });
    const id = await createLeague(admin);
    await addMember(id, temp);
    await addPool(id, 50);
    await withTransaction((tx) =>
      startDraft(tx, id, admin, { members: 2, groupCount: 1 }),
    );
    await getSql()`delete from auth.users where id = ${temp}`;
    expect(await groupRows(id)).toHaveLength(1);
    await getSql()`delete from public.leagues where id = ${id}`;
    const left = await getSql()`
      select 1 from public.draft_groups where league_id = ${id}`;
    expect(left).toHaveLength(0);
  });

  it("does not let a join slip in around the start", async () => {
    const id = await league(1, 50);
    const late = players[5];
    const results = await Promise.allSettled([
      withTransaction((tx) =>
        startDraft(tx, id, admin, { members: 2, groupCount: 1 }),
      ),
      addMember(id, late),
    ]);
    const members = await getSql()`
      select user_id from public.league_members where league_id = ${id}`;
    const grouped = await groupRows(id);
    const [lg] =
      await getSql()`select status from public.leagues where id = ${id}`;
    if (lg.status === "drafting") {
      // Either the join ran first (then the start saw 3 and refused, so the league
      // would still be pre_draft) or it was refused by the guard.
      expect(members.map((m) => m.user_id)).not.toContain(late);
      expect(grouped).toHaveLength(2);
    } else {
      expect(results[0].status).toBe("rejected");
      expect(members.map((m) => m.user_id)).toContain(late);
      expect(grouped).toHaveLength(0);
    }
  });
});
