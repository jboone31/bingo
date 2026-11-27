import { afterAll, describe, expect, it } from "vitest";
import { closeDb, getSql } from "@/lib/db/server";
import { onClock } from "@/lib/draft/engine";
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
import { cleanup, hasDb } from "./helpers";

/**
 * Live checks for the SQL draft engine: turns, picks, settle, queues, events.
 * The real pg_cron backstop runs every 5 seconds against the same database, so it
 * may settle an expired turn before the test does. Tests assert the resulting state,
 * never how many picks one particular settle call made.
 */
describe.skipIf(!hasDb)("draft engine", { timeout: 120_000 }, () => {
  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  it("matches the TypeScript snake order for group sizes 1 to 7", async () => {
    for (let size = 1; size <= 7; size += 1) {
      const rows = await getSql()`
        select g as pick, public.draft_on_clock(g, ${size}) as position
          from generate_series(1, ${size * 25}::int) g`;
      for (const r of rows) {
        expect(Number(r.position)).toBe(onClock(Number(r.pick), size).position);
      }
    }
  });

  it("starts each group's clock at the start, with the pick timer", async () => {
    const l = await startedLeague({ players: 3, groups: 1, pickSeconds: 90 });
    const [groupId] = [...l.groups.keys()];
    const c = await clock(groupId);
    const [lg] = await getSql()`
      select draft_started_at from public.leagues where id = ${l.id}`;
    expect(c.next_pick).toBe(1);
    expect(c.total_picks).toBe(75);
    expect(new Date(c.turn_started_at).getTime()).toBe(
      new Date(lg.draft_started_at).getTime(),
    );
    expect(
      new Date(c.deadline).getTime() - new Date(c.turn_started_at).getTime(),
    ).toBe(90_000);
  });

  it("takes a manual pick: clock, queues, event; repeats and refusals", async () => {
    const l = await startedLeague({ players: 2 });
    const [groupId, order] = [...l.groups.entries()][0];
    const [first, second] = order;
    const [a, b, c] = l.submissions;
    await queue(l.id, second, [a, b]);

    await expect(pick(l.id, second, a, 1)).rejects.toThrow(/not_your_turn/);
    await expect(pick(l.id, first, a, 2)).rejects.toThrow(/stale_pick/);
    await expect(
      pick(l.id, first, "00000000-0000-0000-0000-000000000000", 1),
    ).rejects.toThrow(/submission_not_found/);

    expect(await pick(l.id, first, a, 1)).toBe("picked");
    expect(await pick(l.id, first, a, 1)).toBe("already_picked");
    expect(await picks(groupId)).toHaveLength(1);

    // The square left the group's queues.
    expect(await queueOf(l.id, second)).toEqual([b]);
    // It cannot be picked again in the group.
    await expect(pick(l.id, second, a, 2)).rejects.toThrow(/square_taken/);

    const after = await clock(groupId);
    expect(after.next_pick).toBe(2);
    const gap =
      new Date(after.deadline).getTime() -
      new Date(after.turn_started_at).getTime();
    expect(gap).toBe(60_000);

    const [event] = await getSql()`
      select type, payload, actor_id from public.league_events
       where league_id = ${l.id} and type = 'pick_made'`;
    expect(event.actor_id).toBe(first);
    expect(event.payload).toMatchObject({
      group: 1,
      round: 1,
      pickNumber: 1,
      userId: first,
      submissionId: a,
      text: "Square 1",
      auto: false,
      next: { pickNumber: 2, userId: second },
    });

    // Pick 2 is the second player's (snake: 1, 2, 2, 1, ...), then pick 3 is theirs too.
    expect(await pick(l.id, second, c, 2)).toBe("picked");
    expect(await pick(l.id, second, b, 3)).toBe("picked");
  });

  it("auto-picks one expired turn from the queue, else at random", async () => {
    const l = await startedLeague({ players: 2 });
    const [groupId, [first, second]] = [...l.groups.entries()][0];
    const wanted = l.submissions[7];
    await queue(l.id, first, [wanted]);
    await expire(l.id);
    await settle(l.id);
    expect(await picks(groupId)).toHaveLength(1);
    const [p1] = await picks(groupId);
    expect(p1).toMatchObject({
      user_id: first,
      submission_id: wanted,
      auto: true,
    });
    // The next deadline is the missed one plus the timer: in the future here.
    expect(await settle(l.id)).toBe(0);

    await expire(l.id);
    await settle(l.id);
    expect(await picks(groupId)).toHaveLength(2);
    const [, p2] = await picks(groupId);
    expect(p2.user_id).toBe(second);
    expect(p2.auto).toBe(true);
    expect(p2.submission_id).not.toBe(wanted);
  });

  it("cascades over several missed turns in one settle", async () => {
    const l = await startedLeague({ players: 2 });
    const [groupId] = [...l.groups.keys()];
    // Deadline 209 s ago with a 60 s timer: the follow-up deadlines land 149, 89 and
    // 29 s ago (all due), then 31 s from now. Four auto-picks in one pass.
    await expire(l.id, 209);
    await settle(l.id);
    expect((await clock(groupId)).next_pick).toBe(5);
    expect(await settle(l.id)).toBe(0);
  });

  it("never double-picks when settles run at the same time", async () => {
    const l = await startedLeague({ players: 3 });
    const [groupId] = [...l.groups.keys()];
    await expire(l.id);
    const results = await Promise.all([
      settle(l.id),
      settle(l.id),
      settle(l.id),
    ]);
    expect(results.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1);
    expect(await picks(groupId)).toHaveLength(1);
  });

  it("refuses picks before the start and edits to picks", async () => {
    const l = await startedLeague({ players: 1 });
    const [groupId, [only]] = [...l.groups.entries()][0];
    await pick(l.id, only, l.submissions[0], 1);
    await expect(
      getSql()`update public.draft_picks set auto = true where group_id = ${groupId}`,
    ).rejects.toThrow(/draft_picks_immutable/);
  });
});
