# F6: Draft Setup And Start. Requirements
Depends on F3 and F4 (and uses the F5 event log). Rules referenced: `draft-rules.md`
(Pre-Draft, Starting The Draft, The Draft), `conventions.md` (Access Model, RLS
Policies, Database, Server Routes, Events, Dev Scenarios).
## Decisions Recorded
- **Group count**: a whole number from 1 to 10, default 1. The admin changes it any
  time while `pre_draft`. "At least as many players as groups" is checked only at the
  start, because members can join and leave after it is set; the settings screen warns
  early.
- **Pick timer**: any whole number of seconds from 10 to 900 (15 minutes, for slow or
  asynchronous drafts), default 60. Entered as seconds, with the value also shown in
  minutes and seconds. Changeable while `pre_draft`.
- **Where**: a "Draft setup" panel on the admin settings page holds the group count,
  timer, the live start gate and the Start button. The overview shows everyone the
  group count, timer and gate (read only), as in the wireframe.
- **Confirmation**: a dialog that summarizes the draft (players, groups and their
  sizes, timer, pool size) and warns that nobody can join, leave or edit the pool
  afterwards and that it cannot be undone. No typed confirmation.
- **The draft date does not gate the start.** It stays display-only; the admin starts
  whenever they choose. (This settles the open product question.)
- **What the start writes**: league `status = drafting` and `draft_started_at`, one
  row per group, and one row per member giving their group and draft position. Groups
  and orders are visible to every member. The shuffle uses the server's
  cryptographic random source.
- **The start is safe to repeat**: a second start returns "already started" without
  changing anything, so no request id is needed. The start request carries the player
  and group counts the admin confirmed; if either changed meanwhile, the start is
  refused so the admin can review the new numbers.
- **No turns or deadlines in F6.** F7 derives the first turn from `draft_started_at`
  and the order. Until F7 ships, a started league sits in `drafting` with no clock,
  which only affects seed and test leagues.
- **Events**: `draft_settings_changed` (new group count and timer) and `draft_started`
  (group count and sizes), through the F5 log.
- **No extra start rules** beyond `draft-rules.md`: admin only, `pre_draft` only,
  `N >= G`, pool `>= ceil(N / G) x 25`. A one-player league can start.
- Queues stay in place at the start (F7's auto-pick uses them). The existing guards
  freeze the pool, membership and queues once the status is `drafting`.
## User Stories And Acceptance Criteria
### R1. Draft settings
As the admin, I choose how many groups there are and how long each pick lasts.
1. The settings page has a Draft setup panel with a group count (1 to 10) and a pick
   timer in seconds (10 to 900), both prefilled with the saved values.
2. Saving sends only changed values. Out-of-range, fractional or non-numeric values
   are refused with a message and nothing is saved.
3. Only the admin can save, and only while `pre_draft`. The database refuses a change
   to either value once the league has left `pre_draft`, whatever the caller.
4. A save that changes a value appends one `draft_settings_changed` event; a save that
   changes nothing appends none.
5. The timer's value is also shown in minutes and seconds (for example
   "2 min 30 s").
### R2. The start gate, shown live
1. The Draft setup panel shows players `N`, groups `G`, the group sizes
   (`floor(N / G)` or `ceil(N / G)`), and "Pool P / R needed" where
   `R = ceil(N / G) x 25`.
2. When the group count field changes, the gate and group sizes update before saving.
3. When `N < G`, the panel says there are too few players for that many groups.
4. When `P < R`, the panel says how many more squares are needed.
5. The Start button is disabled, with the reason shown, when the gate is not met or
   the shown group count is not saved yet.
6. The overview shows every member `G`, the timer and "Pool P / R needed" while
   `pre_draft`.
### R3. Start the draft
1. Start opens a confirmation dialog with the summary and the warning. Cancel changes
   nothing.
2. Confirming starts the draft only if the caller is the admin, the league is
   `pre_draft`, `N >= G`, the pool holds at least `R`, and `N` and `G` equal the values
   in the request. The server checks all of these against current data inside one
   transaction that holds the league row lock.
3. A refused start explains why (`not_admin`, `too_few_players`, `pool_too_small`,
   `draft_setup_changed`) and changes nothing.
4. A start in a league already `drafting` (or later) returns success with
   `alreadyStarted: true` for the admin and changes nothing.
5. On success: the status is `drafting`; `draft_started_at` is the database time;
   members are split into `G` groups whose sizes differ by at most one; each group has
   a random order with positions 1 to its size; every member is in exactly one group.
6. The start appends one `draft_started` event, in the same transaction.
7. After the start, joining, leaving, removing, pool edits, queue edits, draft date,
   join code and draft settings are all refused (existing guards plus R1.3).
### R4. Groups after the start
1. Every member can read every group in the league and each group's order, with
   display names. Non-members cannot read any of it.
2. Nobody can write group rows directly. Group rows cannot be changed after the
   start.
3. The overview shows a Draft groups panel after the start: each group's players in
   draft order, with the viewer's own group first and marked.
4. Deleting a league removes its groups.
### R5. Dev scenarios
1. `ready_three_groups`: 15 players, 125 squares, `G = 3`, exactly at the gate.
2. `pool_short`: 15 players, 100 squares, `G = 1`, so the gate blocks the start.
3. `draft_started`: 15 players, 125 squares, `G = 3`, started through the real start
   code.
4. Existing scenarios keep their behavior (group count 1, timer 60, not started).
## Out Of Scope
- Turns, deadlines, picks, auto-pick and the timer itself (F7).
- Realtime for groups and group-scoped events (F7).
- The draft room and big screen (F8, F9).
- Undoing a start, or restarting a draft.
- Choosing groups by hand.
