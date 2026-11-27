# F5: Realtime And Event Log. Requirements
Depends on F2 (and reads F3 pool routes as mutation points). Rules referenced:
`tech.md` (Real-Time Approach), `conventions.md` (Access Model, RLS Policies,
Database, Server Routes, Dev Scenarios), `reference-bbb.md`.
## Decisions Recorded
- **Events recorded** (league level only): a member joined, left or was removed; the
  admin changed; the draft date changed; the join code was regenerated; the pool
  changed. A pool change is **one event per route call** that carries a kind and a
  count, never the rows (a 375-row CSV is one event). Queues are private and never
  produce events. Deleting a league produces no event (the cascade removes the log);
  clients find out on their next read.
- **One log table, `league_events`**, append-only, with a **per-league sequence**
  (`seq`, starting at 1, no gaps). A global counter is not used: it can commit out of
  order, so a client could skip a row that commits late. Per-league `seq` is assigned
  while the league row is locked, so commit order equals `seq` order.
- **Written by the server in the same transaction as the change.** The change and its
  event commit or roll back together. An event is appended only when something
  actually changed (a repeated request that changes nothing adds no event).
- **Names are copied into the payload** (actor and subject display names at the time),
  so the feed still reads correctly after a member leaves or is removed and their
  profile is no longer readable to the others.
- **Event types are open.** The type column is a format check, not a list, so F7 adds
  draft events without altering the table. Clients render an unknown type as a generic
  line and never crash on it.
- **Retention: keep everything.** League events are low volume and are deleted with the
  league. Revisit in F7 if draft events need pruning.
- **Server time**: `GET /api/time` returns the server clock. Clients estimate their
  offset from the round-trip midpoint, keeping the sample with the shortest round trip
  (the BBB pattern). It is used for countdowns in F7 and F8 and displays nothing in F5
  beyond a dev readout.
- **Client delivery**: subscribe to Realtime `postgres_changes` inserts on
  `league_events` filtered by league, then catch up by reading events after the last
  seen `seq` through RLS. No new read route. Order and duplicates are fixed on the
  client by `seq`.
- **First consumer**: the league overview shows an Activity list (latest 50) and
  refreshes its server-rendered parts (members, pool count, draft date) when an event
  arrives.
- Group scoping is out of scope; F7 adds group events and their rules.
## User Stories And Acceptance Criteria
### R1. Every league change is recorded
As a member, I can see what happened in my league.
1. These actions append one event each, in the same transaction as the change:
   `member_joined`, `member_left`, `member_removed`, `admin_transferred`,
   `draft_date_changed`, `join_code_regenerated`, `pool_changed`.
2. `pool_changed` has kind `added`, `imported`, `edited`, `deleted` or `cleared` and a
   `count`. A CSV dry run appends nothing. An `edited` event is appended only when the
   row changed.
3. A repeat that changes nothing appends nothing: joining when already a member,
   leaving when not a member, setting the draft date to its current value, deleting a
   missing submission, a repeated import with the same request id.
4. If the change fails or rolls back, no event remains.
5. `seq` increases by exactly one per event within a league, with no gaps, including
   when requests run at the same time.
6. The payload holds names and counts only. It never holds the join code, a CSV row,
   email addresses or user ids beyond those needed to identify the subject.
7. The payload is a JSON object of at most 2,000 bytes.
8. Events cannot be edited. Update is refused by a trigger; there are no update or
   delete grants.
### R2. Who can read events
1. Every member of a league can read that league's events.
2. A non-member cannot read any of them, through a query or through Realtime.
3. A removed or departed member stops receiving events at once, because access is
   checked against current membership.
4. No signed-in user can insert, update or delete a row directly.
5. The function that appends events is not executable by `anon` or `authenticated`.
### R3. Realtime subscription with catch-up
1. A client for a league subscribes to new events and applies them in `seq` order.
2. The same event delivered twice, or out of order, is applied once, in order.
3. When the client sees a hole in `seq`, it reads the missing events after the last
   contiguous `seq` and then continues.
4. On every (re)subscription, after a connection loss, when the tab becomes visible
   again, and every 60 seconds while visible, the client reads events after its last
   `seq`. Catch-up reads page through results until nothing is left.
5. The client subscribes before it reads, so no event falls between the two.
6. Leaving the page closes the subscription.
7. A failed read shows the last good state and retries on the next trigger. It does
   not show an error toast for background catch-up.
### R4. Server time
1. `GET /api/time` returns `{ ok: true, now }` with the server clock in milliseconds,
   for signed-in users, never cached.
2. The client takes several samples and keeps the offset from the one with the
   shortest round trip. The estimate is the server time at the round-trip midpoint
   minus the client time at the midpoint.
3. The offset is measured again on reconnect and when the tab becomes visible after
   being hidden.
4. `serverNow()` returns the client clock plus the offset. Before the first sample it
   returns the client clock.
### R5. The Activity list on the league overview
1. The overview shows an Activity section with the latest 50 events, newest first,
   each as a sentence and a time (`LocalTime`).
2. A new event appears at the top without a reload. Members, pool count and draft date
   shown on the overview update within about a second of the event (the page refreshes
   its server data, debounced).
3. An unknown event type shows as "Something changed".
4. An empty log shows an empty state.
5. The section is readable at 360px and uses design tokens and `components/ui` only.
### R6. Dev scenario and tooling
1. A scenario `league_with_activity` seeds a league with about 60 events of mixed
   types, so the 50-event cap and ordering can be seen without clicking.
2. Existing scenarios are unchanged (they seed no events).
3. Dev tools stay gated by `isDevToolsEnabled()` and touch only tagged leagues.
## Out Of Scope
- Draft and group events, group access rules, Realtime channel design for groups (F7).
- Draft timer, settle and `pg_cron` (F7).
- A full-screen or cross-group feed (F9).
- Pruning events.
- Live updates on pages other than the overview (they can adopt the hook later).
- Notifying a removed member that they were removed.
