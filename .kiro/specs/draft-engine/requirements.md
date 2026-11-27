# F7: Draft Engine And Timers. Requirements
Depends on F5 and F6. Rules referenced: `draft-rules.md` (The Draft, Boards),
`tech.md` (Draft Timer Approach, Real-Time Approach), `conventions.md`,
`reference-bbb.md`.

## Decisions Recorded
- **The engine is SQL.** One set of Postgres functions holds the turn order, the
  deadline rule, auto-pick, the settle loop and completion. Routes call them inside
  their transaction, and the `pg_cron` backstop calls them directly, so there is one
  implementation and the backstop needs no web server. (One Supabase project serves dev
  and production, and Supabase cannot reach a laptop.) This departs from "rules live in
  `lib/` as TypeScript" in `conventions.md`. A pure TypeScript model of the same rules
  (`lib/draft/engine.ts`) is property-tested, and integration tests check the SQL
  against it.
- **Snake order.** Pick numbers run 1 to `25 x k` in a group of `k`. Round
  `r = ceil(n / k)`. Odd rounds go in position order 1 to `k`; even rounds go `k` to 1.
- **The clock.**
  - Turn 1 starts at `draft_started_at`. Its deadline is that time plus `pick_seconds`.
  - After a manual pick, the next deadline is the pick time plus `pick_seconds`.
  - After an auto-pick for a missed deadline, the next deadline is that missed
    deadline plus `pick_seconds`. Several missed turns therefore settle in one pass,
    and a present player loses at most the backstop's lag.
  - The database clock decides; clients only display.
- **Backstop**: `pg_cron` every 5 seconds settles every drafting league with a due
  turn. Connected clients nudge about 0 to 1 second after a deadline, and every pick,
  nudge and queue write settles first.
- **Picking**: only the player on the clock picks, never the admin for someone else.
  The request carries the pick number it is for, so a repeat succeeds without a second
  pick and a stale request is refused.
- **Picked squares leave the group's queues and pool**: when a square is picked in a
  group, it is removed from the queue of every player in that group, in the same
  transaction. While `drafting`, the pool hides it from that group's players. Nothing
  changes for other groups: the square stays in their pool and queues until it is
  picked there. The submission row is never deleted (other groups, picks and boards
  point at it).
- **Auto-pick**: the top square in the player's queue that is still available in
  their group, else a random available square. Because the pool passed the start gate,
  a square is always available.
- **Events**: draft events go in the existing `league_events` log, so there is one
  Realtime channel per league. Every member may see every group's confirmed picks, so
  no group-level privacy is needed. Each pick event carries the full pick (group,
  round, pick number, player, square, auto or manual, and the next turn). Retention:
  keep everything.
- **Completion**:
  - A group is done after `25 x k` picks.
  - When the last group finishes, one completion function moves the league to
    `in_progress`, stamps `draft_completed_at` and appends `draft_completed`, all in
    the same transaction.
  - F10 adds board generation to that function. Leagues that finish before F10 get
    their boards from an F10 backfill.
- **Memberships cannot be deleted** once a league has left `pre_draft`, except by
  deleting the league itself, so a draft never has a hole.
- **Leagues started before F7** get a clock that starts when the migration runs.
- **Queues** are editable while `drafting` (add, remove, reorder). They are read only
  once the league is `in_progress`. A square already picked in your group cannot be
  added.
- **Dev controls** (dev flag, seed leagues only), from a panel on the overview:
  - "Expire the current turns" sets every running deadline to now and settles.
  - "Bots on/off": with bots on, a seed player's turn is due the moment it starts, so
    seed players pick from their queues at once and only real players' turns wait.
  - There is no timer below 10 seconds.
- **What F7 shows**: a read-only Draft status panel on the overview, with each group's
  round, who is on the clock with a countdown, and the last few picks. Manual picking
  in the browser comes with F8. F7 is verified with tests, bots and expire-now.

## User Stories And Acceptance Criteria
### R1. Turns and the clock
1. When a draft starts, each group has a clock: pick 1, on the clock is position 1,
   and the deadline is `draft_started_at + pick_seconds`.
2. The player on the clock for pick `n` follows the snake rule above, for every group
   size from 1 to 100.
3. A manual pick sets the next deadline to the database time of the pick plus
   `pick_seconds`. An auto-pick sets it to the missed deadline plus `pick_seconds`.
4. After pick `25 x k` the group is finished. It has no deadline and no player on the
   clock.
5. Every player in a finished group has exactly 25 picks, and no square appears twice
   in one group.
### R2. Manual picks
1. `POST /api/leagues/[leagueId]/draft/pick` with `{ submissionId, pickNumber }`
   picks for the caller.
2. The server settles first, then accepts the pick only if:
   - the league is `drafting`;
   - the caller is on the clock in their group;
   - `pickNumber` is the group's current pick;
   - the square is in the league's pool and not yet picked in that group.
3. Refusals have reasons:
   - `draft_not_running`: the league is not `drafting`.
   - `not_your_turn`: someone else is on the clock (including when the caller's turn
     already passed to an auto-pick).
   - `stale_pick`: the pick number is not current.
   - `square_taken`.
   - `submission_not_found`.
   - Non-members get 404.
   - Nothing changes on a refusal.
4. Repeating an accepted request (same caller, pick number and square) returns success
   with `alreadyPicked: true` and changes nothing.
5. The pick, its queue removals, the clock change, its events, and completion (when it
   is the last pick) commit together.
6. The database refuses a second pick of the same square in a group, and a second pick
   with the same pick number, whatever the caller.
### R3. Settle and auto-pick
1. Settling a league auto-picks every turn whose deadline has passed, in order, in
   every group, until no running turn is past its deadline. Each auto-pick takes the
   top available square in the player's queue, else a random available square.
2. Settling is safe to run at the same time from several callers. Each turn is decided
   once: callers serialize on the league row lock, and the unique constraints back
   that up.
3. Settling a league that has nothing due changes nothing and appends nothing.
4. An auto-pick appends the same event as a manual pick, marked auto.
5. `POST /api/leagues/[leagueId]/draft/settle` (any member) settles and returns
   `{ ok, now, picks }`: the server clock in milliseconds and the number of
   auto-picks made.
6. A `pg_cron` job runs every 5 seconds and settles every drafting league with a due
   turn. A failure in one league does not stop the others. It skips leagues another
   transaction holds.
7. Every queue write during the draft settles first.
### R4. Queues during the draft
1. Members can add, remove and reorder their queue while `drafting`. The database
   guard allows it.
2. Adding a square already picked in the caller's group is refused with
   `square_taken`.
3. A pick removes that square from the queue of every member of the group.
4. Queue edits are refused once the league is `in_progress`.
5. While `drafting`, the pool page lists, counts and filters only squares not picked in
   the viewer's group. Players in other groups still see the square until it is picked
   in their group.
### R5. Completion
1. When a group's last pick is made, a `group_finished` event is appended.
2. When every group has finished, in the same transaction:
   - the league becomes `in_progress`;
   - `draft_completed_at` is set;
   - `draft_completed` is appended.
3. Completion happens once, whichever caller makes the last pick.
### R6. Data access
1. Members read every group's clock and picks. Non-members read nothing.
2. No signed-in user writes clocks or picks directly. The engine functions are not
   executable by `anon` or `authenticated`.
3. Picks cannot be edited.
4. Memberships cannot be deleted while the league is `drafting` or `in_progress`,
   except by deleting the league.
### R7. The Draft status panel
1. While `drafting`, the overview shows for each group:
   - the round and pick;
   - who is on the clock, with a countdown to the deadline in server time;
   - the last 5 picks.

   The viewer's group comes first.
2. When a countdown reaches zero, the page nudges settle once, after a random delay of
   0 to 1 second, and then shows the new state.
3. When the draft is complete, the panel says so.
### R8. Dev controls
1. On a seed league's overview with dev tools enabled, the admin sees a Dev draft
   panel with "Expire current turns" and "Bots on/off". Nothing shows otherwise, and
   the route returns 404.
2. "Expire" sets every running deadline to now and settles.
3. With bots on, a seed player's turn is due as soon as it starts; their auto-pick uses
   the time of the pick as the basis for the next deadline. Real players' turns wait
   as normal.
4. Both touch only leagues with a `seed_scenario` tag that the caller belongs to.
### R9. Dev scenarios
1. `draft_mid`: 15 players in 3 groups, started, 2 rounds done by auto-pick, bots on.
2. `draft_expired`: started, with every group's deadline in the past, so the backstop
   (or the next request) auto-picks once per group.
3. `draft_last_round`: started, 24 rounds done, bots off.
4. `draft_started` keeps working: a running clock and no picks.

## Out Of Scope
- The draft room UI and manual picking in the browser (F8).
- A full-screen or cross-group feed (F9).
- Board generation (F10).
- Pausing a draft, undoing a pick, or an admin picking for someone.
- Timers below 10 seconds.
