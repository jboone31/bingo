import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getSql, withTransaction } from "@/lib/db/server";
import { insertSeedEvents } from "@/lib/dev/seedEvents";
import { appendLeagueEvent } from "@/lib/events/append";
import { memberJoined } from "@/lib/events/payload";
import {
  addMember,
  asRole,
  cleanup,
  createLeague,
  createUser,
  hasDb,
} from "./helpers";

/** Live checks for league_events: RLS, append-only, seq ordering and the function. */
describe.skipIf(!hasDb)("league events", { timeout: 60_000 }, () => {
  let admin: string;
  let member: string;
  let stranger: string;
  let league: string;

  const append = (leagueId: string, type = "pool_changed", actor?: string) =>
    getSql()`select public.append_league_event(
      ${leagueId}, ${type}, '{"n":1}'::jsonb, ${actor ?? null}) as seq`;

  beforeAll(async () => {
    admin = await createUser({ full_name: "E Admin" });
    member = await createUser({ full_name: "E Member" });
    stranger = await createUser({ full_name: "E Stranger" });
    league = await createLeague(admin);
    await addMember(league, member);
  });

  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  it("appends with a gap-free, increasing seq per league", async () => {
    const other = await createLeague(admin);
    const a = await append(league);
    const b = await append(league);
    const c = await append(other);
    expect(Number(b[0].seq)).toBe(Number(a[0].seq) + 1);
    expect(Number(c[0].seq)).toBe(1);
  });

  it("gives parallel appends distinct seq values with no gaps", async () => {
    const fresh = await createLeague(admin);
    // Batches of 5 (the pool size): queueing more queries than connections hangs
    // on the Supabase transaction pooler, whatever the query is.
    for (let batch = 0; batch < 4; batch += 1) {
      await Promise.all(Array.from({ length: 5 }, () => append(fresh)));
    }
    const rows = await getSql()`
      select seq from public.league_events where league_id = ${fresh} order by seq`;
    expect(rows.map((r) => Number(r.seq))).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    const lg = await getSql()`
      select last_event_seq from public.leagues where id = ${fresh}`;
    expect(Number(lg[0].last_event_seq)).toBe(20);
  });

  it("leaves no event and no seq hole when the transaction rolls back", async () => {
    const fresh = await createLeague(admin);
    await append(fresh);
    const rollback = Symbol("rollback");
    try {
      await getSql().begin(async (tx) => {
        await tx`select public.append_league_event(${fresh}, 'pool_changed', '{}'::jsonb, null)`;
        throw rollback;
      });
    } catch (error) {
      if (error !== rollback) throw error;
    }
    const next = await append(fresh);
    expect(Number(next[0].seq)).toBe(2);
    const rows = await getSql()`
      select count(*)::int as n from public.league_events where league_id = ${fresh}`;
    expect(rows[0].n).toBe(2);
  });

  it("lets a member read the league's events", async () => {
    await append(league);
    const rows = await asRole(
      "authenticated",
      member,
      (tx) =>
        tx`select seq from public.league_events where league_id = ${league}`,
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it("hides events from a non-member", async () => {
    const rows = await asRole(
      "authenticated",
      stranger,
      (tx) =>
        tx`select seq from public.league_events where league_id = ${league}`,
    );
    expect(rows).toHaveLength(0);
  });

  it("hides events from anon", async () => {
    await expect(
      asRole("anon", null, (tx) => tx`select seq from public.league_events`),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuses direct insert, update and delete by a member", async () => {
    await expect(
      asRole(
        "authenticated",
        member,
        (tx) => tx`insert into public.league_events (league_id, seq, type)
                   values (${league}, 9999, 'pool_changed')`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(
        "authenticated",
        member,
        (tx) =>
          tx`update public.league_events set type = 'x' where league_id = ${league}`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(
        "authenticated",
        member,
        (tx) =>
          tx`delete from public.league_events where league_id = ${league}`,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let authenticated run append_league_event", async () => {
    await expect(
      asRole(
        "authenticated",
        admin,
        (tx) =>
          tx`select public.append_league_event(${league}, 'pool_changed', '{}'::jsonb, null)`,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuses to update a row even for the owner role", async () => {
    await expect(
      getSql()`update public.league_events set type = 'x' where league_id = ${league}`,
    ).rejects.toThrow(/league_events_immutable/);
  });

  it("rejects a bad type, an oversized payload and a missing league", async () => {
    await expect(
      getSql()`select public.append_league_event(${league}, 'Bad Type', '{}'::jsonb, null)`,
    ).rejects.toThrow();
    const big = JSON.stringify({ text: "x".repeat(2100) });
    await expect(
      getSql()`select public.append_league_event(${league}, 'pool_changed', ${big}::jsonb, null)`,
    ).rejects.toThrow();
    await expect(
      getSql()`select public.append_league_event(
        '00000000-0000-0000-0000-000000000000', 'pool_changed', '{}'::jsonb, null)`,
    ).rejects.toThrow(/league_not_found/);
  });

  it("keeps the event but clears the actor when the actor's profile goes", async () => {
    const temp = await createUser({ full_name: "Temp" });
    const fresh = await createLeague(admin);
    await append(fresh, "member_left", temp);
    await getSql()`delete from auth.users where id = ${temp}`;
    const rows = await getSql()`
      select actor_id from public.league_events where league_id = ${fresh}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBeNull();
  });

  it("is in the Realtime publication", async () => {
    const rows = await getSql()`
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public' and tablename = 'league_events'`;
    expect(rows).toHaveLength(1);
  });

  it("removes events with the league", async () => {
    const fresh = await createLeague(admin);
    await append(fresh);
    await getSql()`delete from public.leagues where id = ${fresh}`;
    const rows = await getSql()`
      select 1 from public.league_events where league_id = ${fresh}`;
    expect(rows).toHaveLength(0);
  });
});

describe.skipIf(!hasDb)("seeded events", { timeout: 60_000 }, () => {
  let admin: string;
  let member: string;

  beforeAll(async () => {
    admin = await createUser({ full_name: "Seed Admin" });
    member = await createUser({ full_name: "Seed Member" });
  });

  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  it("inserts a gap-free, time-ordered log and continues the sequence", async () => {
    const league = await createLeague(admin);
    await addMember(league, member);
    await withTransaction((tx) =>
      insertSeedEvents(tx, league, 60, [admin, member]),
    );

    const rows = await getSql()`
      select seq, type, created_at from public.league_events
       where league_id = ${league} order by seq`;
    expect(rows.map((r) => Number(r.seq))).toEqual(
      Array.from({ length: 60 }, (_, i) => i + 1),
    );
    const times = rows.map((r) => new Date(r.created_at as string).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[59] - times[0]).toBeGreaterThan(0);

    const counter = await getSql()`
      select last_event_seq from public.leagues where id = ${league}`;
    expect(Number(counter[0].last_event_seq)).toBe(60);

    // The next real event continues the sequence.
    const next = await withTransaction((tx) =>
      appendLeagueEvent(tx, league, admin, memberJoined("Sam")),
    );
    expect(next).toBe(61);
    const [stored] = await getSql()`
      select jsonb_typeof(payload) as kind, payload->>'name' as name, actor_id
        from public.league_events where league_id = ${league} and seq = 61`;
    expect(stored).toEqual({ kind: "object", name: "Sam", actor_id: admin });
  });

  it("reads back the newest 50 through RLS, newest first", async () => {
    const league = await createLeague(admin);
    await withTransaction((tx) => insertSeedEvents(tx, league, 60, [admin]));
    const rows = await asRole(
      "authenticated",
      admin,
      (tx) => tx`select seq from public.league_events
                  where league_id = ${league} order by seq desc limit 50`,
    );
    expect(rows).toHaveLength(50);
    expect(Number(rows[0].seq)).toBe(60);
    expect(Number(rows[49].seq)).toBe(11);
  });
});
