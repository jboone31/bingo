import { afterAll, describe, expect, it } from "vitest";
import { closeDb, getSql } from "@/lib/db/server";
import {
  clock,
  expire,
  pick,
  picks,
  queue,
  queueOf,
  settle,
  startedLeague,
} from "./draftEngine.helpers";
import { asRole, cleanup, createUser, hasDb } from "./helpers";

/**
 * Live checks for completion, bots, the backstop, guards, RLS and the pool view. The
 * real 5-second backstop also runs, so tests assert state, not settle return values.
 */
describe.skipIf(!hasDb)("draft engine lifecycle", { timeout: 180_000 }, () => {
  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  const tagSeed = (leagueId: string) =>
    getSql()`update public.leagues set seed_scenario = 'draft_started'
              where id = ${leagueId}`;

  it("completes once when the last group finishes", async () => {
    const l = await startedLeague({ players: 3, groups: 2 });
    await tagSeed(l.id);
    // Groups of 2 and 1: 50 and 25 picks. Force them all.
    await getSql()`select public.dev_draft_advance(${l.id}, 50)`;
    for (const groupId of l.groups.keys()) {
      const c = await clock(groupId);
      expect(c.finished_at).not.toBeNull();
      expect(c.deadline).toBeNull();
      const ps = await picks(groupId);
      const users = l.groups.get(groupId)!;
      expect(ps).toHaveLength(users.length * 25);
      for (const u of users) {
        expect(ps.filter((p) => p.user_id === u)).toHaveLength(25);
      }
      expect(new Set(ps.map((p) => p.submission_id)).size).toBe(ps.length);
    }
    const [lg] = await getSql()`
      select status, draft_completed_at from public.leagues where id = ${l.id}`;
    expect(lg.status).toBe("in_progress");
    expect(lg.draft_completed_at).not.toBeNull();
    const events = await getSql()`
      select type, count(*)::int as n from public.league_events
       where league_id = ${l.id} and type in ('group_finished', 'draft_completed')
       group by type order by type`;
    expect(events).toEqual([
      { type: "draft_completed", n: 1 },
      { type: "group_finished", n: 2 },
    ]);
    expect(await settle(l.id)).toBe(0);
    await expect(pick(l.id, l.admin, l.submissions[0], 76)).rejects.toThrow(
      /draft_not_running/,
    );
  });

  it("bots pick at once for seed players only, and wait for real players", async () => {
    const l = await startedLeague({ players: 2 });
    const [groupId, [first, second]] = [...l.groups.entries()][0];
    // Make the second player a seed user (reserved email and the seed flag). 9xx is
    // outside the real seed pool (001 to 100), so it cannot collide with one.
    const fake = `seed-player-${900 + Math.floor(Math.random() * 100)}@bingo-seed.test`;
    await getSql()`
      update auth.users
         set email = ${fake},
             raw_user_meta_data = raw_user_meta_data || '{"seed": true}'::jsonb
       where id = ${second}`;
    await tagSeed(l.id);
    await getSql()`update public.leagues set dev_bots = true where id = ${l.id}`;
    // Pick 1 is the real player's: nothing due.
    expect(await settle(l.id)).toBe(0);
    await pick(l.id, first, l.submissions[0], 1);
    // Picks 2 and 3 are the bot's: made at once, by this settle or the backstop.
    await settle(l.id);
    const c = await clock(groupId);
    expect(c.next_pick).toBe(4);
    expect(
      new Date(c.deadline).getTime() - new Date(c.turn_started_at).getTime(),
    ).toBe(60_000);
    // Restore the email so cleanup and other suites see an ordinary test user.
    await getSql()`update auth.users set email = ${`${second}@example.test`}
                    where id = ${second}`;
  });

  it("refuses bots outside seed leagues", async () => {
    const l = await startedLeague({ players: 1 });
    await expect(
      getSql()`update public.leagues set dev_bots = true where id = ${l.id}`,
    ).rejects.toThrow(/leagues_dev_bots_seed_only/);
  });

  it("the backstop settles due leagues and leaves others alone", async () => {
    const due = await startedLeague({ players: 1 });
    const idle = await startedLeague({ players: 1 });
    await expire(due.id);
    const swept = await getSql()`select public.settle_due_drafts() as n`;
    expect(Number(swept[0].n)).toBeGreaterThanOrEqual(0);
    expect(await picks([...due.groups.keys()][0])).toHaveLength(1);
    expect(await picks([...idle.groups.keys()][0])).toHaveLength(0);
  });

  it("schedules the backstop every 5 seconds", async () => {
    const [job] = await getSql()`
      select schedule, command, active from cron.job
       where jobname = 'bingo_draft_settle'`;
    expect(job).toMatchObject({
      schedule: "5 seconds",
      command: "select public.settle_due_drafts()",
      active: true,
    });
  });

  it("keeps memberships fixed after the start, but deletes with the league", async () => {
    const l = await startedLeague({ players: 2 });
    const member = l.players[1];
    await expect(
      getSql()`delete from public.league_members
                where league_id = ${l.id} and user_id = ${member}`,
    ).rejects.toThrow(/league_not_pre_draft/);
    await getSql()`delete from public.leagues where id = ${l.id}`;
    const left = await getSql()`
      select (select count(*) from public.draft_picks where league_id = ${l.id})::int as p,
             (select count(*) from public.draft_clocks where league_id = ${l.id})::int as c`;
    expect(left[0]).toEqual({ p: 0, c: 0 });
  });

  it("allows queue edits while drafting, refuses them once in progress", async () => {
    const l = await startedLeague({ players: 1, extraPool: 10 });
    const [only] = l.players;
    await queue(l.id, only, [l.submissions[3]]);
    expect(await queueOf(l.id, only)).toEqual([l.submissions[3]]);
    await tagSeed(l.id);
    await getSql()`select public.dev_draft_advance(${l.id}, 25)`;
    await expect(queue(l.id, only, [l.submissions[30]])).rejects.toThrow(
      /league_not_pre_draft/,
    );
  });

  it("lets members read clocks and picks, hides them from others, refuses writes", async () => {
    const l = await startedLeague({ players: 2 });
    const stranger = await createUser({ full_name: "E Stranger" });
    await expire(l.id);
    await settle(l.id);
    const seen = await asRole(
      "authenticated",
      l.players[1],
      (tx) => tx`select 1 from public.draft_picks where league_id = ${l.id}`,
    );
    expect(seen).toHaveLength(1);
    const clocks = await asRole(
      "authenticated",
      l.players[1],
      (tx) => tx`select 1 from public.draft_clocks where league_id = ${l.id}`,
    );
    expect(clocks).toHaveLength(1);
    const hidden = await asRole(
      "authenticated",
      stranger,
      (tx) => tx`select 1 from public.draft_picks where league_id = ${l.id}`,
    );
    expect(hidden).toHaveLength(0);
    await expect(
      asRole(
        "authenticated",
        l.players[0],
        (tx) => tx`update public.draft_clocks set deadline = now()
                    where league_id = ${l.id}`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(
        "authenticated",
        l.players[0],
        (tx) => tx`select public.settle_league(${l.id})`,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("hides a picked square from that group's pool only", async () => {
    // 4 players in 2 groups of 2.
    const l = await startedLeague({ players: 4, groups: 2 });
    const [[g1, g1users], [, g2users]] = [...l.groups.entries()];
    const square = l.submissions[0];
    await queue(l.id, g2users[0], [square]);
    await pick(l.id, g1users[0], square, 1);
    const visible = (user: string) =>
      asRole(
        "authenticated",
        user,
        (tx) => tx`select id from public.available_submissions
                    where league_id = ${l.id} and id = ${square}`,
      );
    expect(await visible(g1users[0])).toHaveLength(0);
    expect(await visible(g1users[1])).toHaveLength(0);
    expect(await visible(g2users[0])).toHaveLength(1);
    expect(await visible(g2users[1])).toHaveLength(1);
    // The other group's queue keeps it.
    expect(await queueOf(l.id, g2users[0])).toEqual([square]);
    const counts = await asRole(
      "authenticated",
      g1users[0],
      (
        tx,
      ) => tx`select sum(count)::int as n from public.available_pool_categories
                  where league_id = ${l.id}`,
    );
    expect(counts[0].n).toBe(l.submissions.length - 1);
    expect((await picks(g1)).length).toBe(1);
  });
});
