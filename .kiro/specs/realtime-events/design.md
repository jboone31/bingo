# F5: Realtime And Event Log. Design
## Data Model
Migration `0008_league_events.sql`, in `begin; ... commit;`.
```sql
alter table public.leagues
  add column last_event_seq bigint not null default 0;
create table public.league_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  seq bigint not null check (seq > 0),
  type text not null check (type ~ '^[a-z][a-z_]{0,39}$'),
  payload jsonb not null default '{}'
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 2000),
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (league_id, seq)
);
```
- The unique `(league_id, seq)` index serves the policy filter and the catch-up read
  (`where league_id = $1 and seq > $2 order by seq`).
- RLS enabled. Policy `league_events_select_member`: `using
  (public.is_league_member(league_id))`.
- `revoke all ... from anon, authenticated; grant select ... to authenticated`.
- `alter publication supabase_realtime add table public.league_events`.
- Trigger `league_events_immutable` (before update) raises `league_events_immutable`,
  except for the one change `on delete set null` makes (actor_id to null), allowed in
  migration 0009.
  Delete is not blocked, because the league cascade must work; no role that clients use
  can delete.
- Function `public.append_league_event(p_league_id uuid, p_type text, p_payload jsonb,
  p_actor uuid) returns bigint`, `security definer`, `search_path = ''`:
  `update public.leagues set last_event_seq = last_event_seq + 1 where id = p_league_id
  returning last_event_seq`, then insert the row and return `seq`. The update takes the
  row lock, so two appenders serialize and `seq` is gap-free; callers already hold the
  lock. Revoke execute from `public`, `anon`, `authenticated`.
- `leagues_touch` bumps `updated_at` on every append. That is acceptable (the league
  did change). Nothing sorts by it.
- Realtime evaluates the select policy per subscriber, so a removed member stops
  receiving rows. Deleting a league cascades deletes, which are not delivered to
  subscribers of an insert-only subscription.
## Pure Logic: `lib/events/`
Framework-free, with tests beside it.
- `types.ts`: `LeagueEvent { id, leagueId, seq, type, payload, actorId, createdAt }`
  and the known payload shapes per type (a discriminated union plus an `unknown` case).
- `payload.ts`: builders such as `memberJoined(name)`, `poolChanged(kind, count)`
  that return `{ type, payload }`. They truncate names to 60 characters and keep
  payloads small.
- `describe.ts`: `describeEvent(event): string`, for example "Sam joined the league",
  "Alex made Sam the admin", "Admin imported 12 squares". Unknown types give
  "Something changed".
- `fold.ts`: `foldEvents(state, incoming)` returns a new state
  `{ events (ascending seq), lastSeq (highest contiguous), hasGap }`. It drops
  duplicates by `seq`, sorts, and recomputes the contiguous high-water mark from a
  base seq (the first loaded event). It is a pure function, so reconnect, catch-up and
  live delivery all use the same code.
- `catchUp.ts`: `catchUpPlan(state)` returns the `afterSeq` to read from, or `null`
  when nothing is missing and no recheck is due.
## Server: `lib/events/`
- `append.ts` (server-only): `appendLeagueEvent(tx, leagueId, actorId, event)` calls
  `select public.append_league_event($1,$2,$3::text::jsonb,$4)`. The `text` cast is
  required: postgres.js stores a string bound to `$3::jsonb` as a JSON string. It takes the output of the
  payload builders. Routes call it after the change, only when something changed.
- `read.ts` (server-only, RLS client): `getRecentEvents(supabase, leagueId, limit)`
  returns the latest `limit` events, newest first, for the overview.
## Mutation Points
Each calls `appendLeagueEvent` in its existing transaction. Names come from the
profiles already loaded or one extra `select display_name`.
| Route | Event | Emit condition |
| --- | --- | --- |
| `POST /api/leagues/join` | `member_joined` | a member row was inserted |
| `POST .../leave` | `member_left` | a member row was deleted |
| `DELETE .../members/[userId]` | `member_removed` | a row was deleted |
| `POST .../transfer` | `admin_transferred` | roles changed |
| `PATCH /api/leagues/[leagueId]` | `draft_date_changed` | value differs |
| `POST .../join-code` | `join_code_regenerated` | always (code is new) |
| `POST .../submissions` | `pool_changed` added, 1 | row inserted |
| `POST .../submissions/import` | `pool_changed` imported, n | not a dry run, not a replay |
| `PATCH .../submissions/[id]` | `pool_changed` edited, 1 | a field changed |
| `DELETE .../submissions/[id]` | `pool_changed` deleted, 1 | a row was deleted |
| `DELETE .../submissions` | `pool_changed` cleared, n | n greater than 0 |
`DELETE /api/leagues/[leagueId]` appends nothing. League creation appends nothing.
Whether something changed is read from each query's `rowCount` or `returning`;
where a query function does not expose it, it is extended minimally (return a boolean
or count) and its tests updated.
## Server Time
- `GET /api/time` (`handle`, Node runtime, `force-dynamic`): `ok({ now: Date.now() })`.
  `Cache-Control: no-store`.
- `lib/time/clockOffset.ts` (pure): `estimateOffset(sample)` with
  `{ sentAt, receivedAt, serverNow }` gives `{ offsetMs, rttMs }` using the midpoint.
  `bestSample(samples)` keeps the shortest `rttMs`. Rejects negative or absurd round
  trips (over 5 seconds).
- `components/realtime/ServerClockProvider.tsx` (client): takes 3 spaced samples on
  mount, repeats on `visibilitychange` to visible and on reconnect, and exposes
  `serverNow()` through context. Mounted in the signed-in shell layout so F7 and F8 need
  nothing further. Clock readouts use `performance.now()` plus a wall-clock anchor to
  avoid clock jumps during a sample.
## Client Subscription
The sequencing lives in `lib/events/feed.ts` (`EventFeed`, framework-free, tested with
a fake source); `components/realtime/supabaseSource.ts` adapts Supabase to it.
`components/realtime/useLeagueEvents.ts` (client hook), input `{ leagueId, initial }`
where `initial` is the server-loaded events:
1. Create the browser Supabase client (`utils/supabase/client.ts`).
2. Open a channel `league:<id>:events` with `postgres_changes` insert on
   `league_events` filtered `league_id=eq.<id>`.
3. On `SUBSCRIBED` (first time and every resubscribe), run catch-up.
4. Each live event goes through `foldEvents`. If `hasGap`, run catch-up.
5. Catch-up: `select * from league_events where league_id = id and seq > lastSeq order
   by seq limit 200`, repeated until fewer than 200 return, folding each page.
6. Also run catch-up on `visibilitychange` to visible and on a 60 second interval
   while visible (a quiet-period recheck, for silently dropped sockets).
7. Cleanup removes the channel and the timers.
Catch-up calls are coalesced: one in flight at a time; a request during a flight sets
a flag that runs it once more afterwards.
The hook returns `{ events, connection }` where `connection` is `connecting`, `live` or
`offline`, used only for a small status dot on the section.
## Overview Page
- `app/(app)/leagues/[leagueId]/page.tsx` loads the latest 50 events through
  `getRecentEvents` (RLS client) and passes them to `<ActivityFeed>`.
- `components/leagues/ActivityFeed.tsx` (client): uses the hook, renders `describeEvent`
  and `LocalTime` per event, newest first, in a `Panel`. When a new event arrives that
  is not already in the initial list, it calls `router.refresh()`, debounced 300 ms,
  so the server-rendered members, pool count and draft date update. The first render
  from `initial` never refreshes.
- Event text is rendered server-safe: no `Intl` (conventions). Times use `LocalTime`.
## Dev Scenario
- `ScenarioPlan` gets `eventCount: number`. Existing entries set `0`.
- `league_with_activity`: admin plus 11 seed players, a pool of 40, `eventCount` 60.
  `lib/dev/seedEvents.ts` inserts the rows directly with past timestamps 20 minutes
  apart (the append function stamps "now"), seq 1 to 60, and sets `last_event_seq` to
  match, cycling the known types with seed member names. The events are sample noise. Reset already deletes the league, which cascades
  the log.
## Testing Plan
- Property tests (fast-check, 100+ runs): `foldEvents` gives the same result for any
  order and duplication of the same event set; `lastSeq` never passes a hole;
  `catchUpPlan` returns the first missing seq; `estimateOffset` is exact when the
  server clock is a fixed offset and the trip is symmetric; `bestSample` picks the
  minimum round trip.
- Example tests: `describeEvent` for each type and an unknown type; payload builders
  truncate and stay under 2,000 bytes.
- Route tests (mocked queries): each mutation point appends exactly one event with the
  right type, and none when the change was a no-op or the request was rejected.
  `GET /api/time` shape and auth.
- Component tests (jsdom, mocked Supabase client): the feed renders initial events
  newest first; a live insert is added once; a gap triggers a catch-up read; resubscribe
  triggers a catch-up; unmount closes the channel; `router.refresh` is called after a
  new event and not on first render.
- Integration (`test/integration/leagueEvents.integration.test.ts`, live database):
  a member reads; a non-member gets no rows; direct insert, update and delete fail for
  `authenticated`; `append_league_event` is not executable by `authenticated`; 20
  parallel appends give seq 1 to 20 with no gaps; a rolled-back transaction leaves no
  event and no seq hole; deleting the league removes its events; the table is in the
  `supabase_realtime` publication; updating a row raises `league_events_immutable`.
- Manual (browser, the user): two tabs and Realtime delivery, reconnect catch-up after
  going offline, layout at 360px.
