# F8: Draft Room UI. Requirements
Depends on F7 (and reuses F4's queue and F5's realtime). Rules referenced:
`draft-rules.md` (The Draft), `conventions.md` (Client Code, Design, Events),
`.kiro/specs/design-system/` (draft room wireframe, forced dark).

## Decisions Recorded
- **One draft room per player** at `/leagues/[leagueId]/draft`, forced dark. It is the
  control center during the draft: a banner, the pool, the queue and the picks.
  While a league is drafting, the league navigation gets a Draft tab and the overview
  links to the room.
- **The banner shows your group**: who is on the clock, the time left, and the latest
  event in your group. A one-line ticker under it shows the latest pick in each other
  group. This settles the open question of whether the banner is group-wide or
  league-wide.
- **Your turn is obvious.**
  - The banner grows, turns to the accent color and pulses.
  - The tab title becomes "Your pick, 0:42", and the timer turns urgent in the last
    10 seconds.
  - Phones that support it vibrate once.
  - An optional "Sound on my turn" toggle (off by default, remembered on the device)
    plays a short tone.
  - When you are next, a quieter "You're up next" state shows.
  - With reduced motion, nothing pulses or flashes; the banner stays solid and bold.
  - Alerts while the tab is closed (push notifications) are out of scope: they need a
    secure context, and the LAN address is plain `http`.
- **Picking**: every square in the pool and the queue has a Draft button, enabled only
  on your turn. It opens a confirmation, then picks. If the turn ends while the dialog
  is open, the dialog closes and says what happened.
- **Phone layout**: the banner is sticky at the top, with tabs Pool, Queue and Picks.
  Wide screens show columns. This replaces the wireframe's queue bottom sheet:
  tabs are simpler and easier to tap.
- **Live without reloads**: the room loads one consistent snapshot, then applies each
  draft event directly. It never reloads the page, which would reset a queue drag. A
  snapshot route returns everything at the event number it reflects. The room
  re-reads it after a refused pick, and the event feed's catch-up covers reconnects
  and gaps.
- **The pool is loaded whole** (at most 5,000 squares) and filtered, sorted and searched
  in the browser with the same rules as the pool page. A drafted square leaves your
  group's pool the moment its event arrives.
- **Picks views**: "My picks" in round order, and a group grid (rounds by players)
  for your group, switchable to other groups. The pool search can include drafted
  squares and say where each went ("Taken in your group by Sam", "Group 2: Ada").
- **After the draft**: the room says the draft is complete and shows every group's
  grid, read only, until boards arrive (F10, F11).
- **Snapshot through a server route**: this departs from browser reads through RLS
  (`conventions.md`), and the reason is recorded here. The room needs the pool,
  groups, clocks and picks consistent with one event number, which separate RLS
  requests cannot give. The route checks membership and returns only the caller's own
  queue.
- **Dev scenario** `draft_your_turn`: bots on, settled until it is your turn.

## User Stories And Acceptance Criteria
### R1. The draft room
1. `/leagues/[leagueId]/draft` is for members only (otherwise not found). It is dark
   whatever the system setting is.
2. Before the start it says the draft has not started, with a link to the overview.
   After completion it says the draft is complete and shows every group's grid.
3. While drafting, the league navigation shows a Draft tab, and the overview shows a
   prominent link to the room.
4. Wide screens show the banner, then the pool beside a column with the queue and
   picks. Phones show the sticky banner and tabs Pool, Queue and Picks. Touch targets
   are at least 44px.
### R2. The banner
1. It shows the viewer's group number, the round, "pick p of t", the player on the
   clock and a countdown in server time.
2. It shows the latest event in the viewer's group as a sentence (for example
   "Ada picked "Rain" (auto)").
3. A ticker line shows each other group's latest pick.
4. **Your turn**:
   - the banner uses the accent style and says "Your pick";
   - it pulses (unless reduced motion is set);
   - the tab title is "Your pick, m:ss";
   - the phone vibrates once per turn where supported;
   - the sound plays once per turn if the toggle is on.
5. **Urgent**: in the last 10 seconds of your turn, the timer switches to the danger
   style.
6. **Up next**: when your turn is the next pick in your group, the banner says
   "You're up next".
7. When your turn ends, the title goes back to normal.
8. A connection badge shows Live or Reconnecting.
### R3. The pool
1. It lists squares not yet drafted in your group, filtered by category, text search
   and sort, with the same rules as the pool page (category ignores case,
   "Uncategorized", a literal substring search, a stable sort).
2. Each row has Add to queue (or Queued with remove) and Draft.
3. A drafted square disappears from your group's pool when its event arrives.
4. "Include drafted squares" also shows drafted squares, marked with where they went,
   and those have no Draft or queue button.
5. Long lists render a page at a time (100 rows) with "Show more".
### R4. The queue
1. It shows your queue with drag and Move up/down, as on the queue page. Each row has a
   Draft button.
2. A drafted square leaves your queue when its event arrives in your group.
3. Adding from the pool updates the queue at once, and the queue tab or column shows
   the new count.
### R5. Drafting a square
1. Draft is enabled only when you are on the clock.
2. It opens a confirmation naming the square. Confirming sends
   `{ submissionId, pickNumber }` for your group's current pick.
3. While the request is in flight, the button shows progress and a second click does
   nothing.
4. On success the dialog closes; the pick appears when its event arrives.
5. On a refusal (`not_your_turn`, `stale_pick`, `square_taken`, `draft_not_running`)
   the dialog closes, a message explains, and the room re-reads its snapshot.
6. If the turn passes while the dialog is open, the dialog closes and says "Your turn
   ended; the pick was made automatically" (or by whoever picked).
### R6. Picks
1. "My picks" lists your picks by round with the square's text.
2. The group grid shows rounds 1 to 25 down and players across (in draft position
   order), with each pick filled in, the current cell highlighted, and auto-picks
   marked.
3. A selector switches the grid to another group.
### R7. Live state
1. `GET /api/leagues/[leagueId]/draft/state` (members) returns, from one consistent
   read:
   - `lastSeq`;
   - the league status;
   - the pick timer;
   - each group with its order and names, its clock and all its picks;
   - the whole pool;
   - the caller's queue ids;
   - the caller's group number.
2. The room applies `pick_made`, `group_finished` and `draft_completed` events with a
   `seq` above the snapshot's `lastSeq`, in order and once. An event at or below it
   changes nothing.
3. Applying the events after a snapshot gives the same state as a later snapshot.
4. The countdown nudges settle once per deadline (as in F7), and the resulting events
   update the room.
### R8. Dev scenario
1. `draft_your_turn`: 15 players in 3 groups, bots on, settled until the viewer is on
   the clock. Groups made only of seed players finish on their own.

## Out Of Scope
- The big screen and the cross-group feed (F9).
- Boards (F10, F11).
- Push notifications, and alerts while the tab is closed.
- Auto-drafting the top of your queue on your behalf before the timer runs out.
