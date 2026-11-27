# F8: Draft Room UI. Design
No migration. Everything F8 reads already exists (F7 tables, events, views).

## Pure Logic: `lib/draftRoom/`
Framework-free, with tests beside it.
- `types.ts`:
  - `RoomSnapshot` has these fields:
    - `lastSeq` and `status`;
    - `pickSeconds`;
    - `myGroup` (a number, or null);
    - `groups`: an array of `{ number, order: {userId, name}[], nextPick,
      totalPicks, deadline, finished, picks: RoomPick[] }`;
    - `pool`: `{ id, text, submitter, category }[]` in added order;
    - `queue`: the caller's submission ids in order.
  - `RoomPick` is `{ pickNumber, round, userId, submissionId, auto }`.
- `reduce.ts`: `applyEvents(state, events)` applies the events in `seq` order and
  skips any with `seq <= state.lastSeq`.
  - `pick_made` appends the pick to its group (matched by group number and pick
    number) and advances the clock from `payload.next`, or finishes the group. If the
    group is the viewer's, it also drops the square from the queue.
  - `group_finished` marks the group finished.
  - `draft_completed` sets the status to `in_progress`.
  - Other event types only advance `lastSeq`.
  - The function is pure and returns a new state.
- `select.ts`:
  - `onClock(group)` reuses `lib/draft/engine.ts`'s `onClock`.
  - `turnState(state, viewerId)` returns one of `"waiting" | "next" | "yours" |
    "finished" | "complete"`.
  - `availablePool(state)` is the pool minus picks in the viewer's group.
  - `whereTaken(state, submissionId)` returns `{ group, name, mine }[]`.
  - `myPicks(state, viewerId)`.
  - `groupGrid(group)` returns 25 rows by `k` cells in position order.
  - `latestInGroup(state, number)` returns the newest pick, for the banner and
    ticker.
- `filter.ts`: `filterPool(rows, query)` uses `PoolQuery` from `lib/pool/query.ts`
  and follows the same rules as the server pool query:
  - a category key that ignores case, with `none` for blank;
  - a literal case-insensitive substring search on text;
  - sorts by text, submitter or category that are stable, with ties in added order.

  It is shared logic, so the pool page and the room cannot disagree.
- `alert.ts`: `titleFor(turn, msLeft, base)` and `URGENT_MS = 10_000`.

## Server
- `lib/draftRoom/snapshot.ts` (server-only), `readRoomSnapshot(tx, leagueId,
  userId)`. It runs on postgres.js inside a transaction that starts with
  `set transaction isolation level repeatable read, read only`, so every select sees
  the same moment. It reads:
  1. the league: `last_event_seq`, `status` and `pick_seconds`;
  2. the groups with their members and display names, in position order;
  3. the clocks;
  4. all picks, in group and pick order;
  5. the pool, in `seq` order;
  6. **the caller's queue only**.

  The server connects as the owner, which bypasses RLS, so the route must authorize
  first (`lockLeagueForMember` is not used: no lock is needed. A membership `select`
  inside the same transaction does the check).
- `GET /api/leagues/[leagueId]/draft/state` (`handle`, `no-store`) returns
  `{ ok, snapshot }`, or 404 for a non-member.
- `app/(app)/leagues/[leagueId]/draft/page.tsx` (server) calls `readRoomSnapshot`
  directly for the first render, under the same membership check.

## Realtime
- `useLeagueEvents` gains an optional `baseSeq`. `stateFromInitial([], baseSeq)`
  starts the fold at the snapshot's `lastSeq`, so the feed catches up from there and
  never replays the whole log. `EventFeed` passes it through. Existing callers are
  unchanged.
- `components/draftRoom/useRoom.ts` (client) holds `RoomSnapshot` in state. It
  subscribes with `useLeagueEvents(leagueId, [], snapshot.lastSeq)` and applies new
  events through `applyEvents`. `resync()` fetches `/draft/state` and replaces the
  state; if the feed's last seq is beyond the new snapshot's, the extra events are
  applied on top. It exposes `{ state, connection, resync, viewerId }`.

## Countdown
- `components/draft/useCountdown.ts` takes the existing `Countdown` logic, including
  its pending-nudge ref, and returns `msLeft`. It still nudges settle once per
  deadline, and takes an optional `onNudged` callback (the room passes a no-op,
  because events update it; the overview keeps `router.refresh`). `Countdown` becomes
  a thin wrapper over it.

## Components: `components/draftRoom/`
All forced dark through `data-theme="dark"` on the room wrapper, styled only with
tokens and `components/ui`.
- `DraftRoom.tsx` (client) holds the layout and tabs on phones. It owns the confirm
  dialog state.
- `DraftBanner.tsx`:
  - It shows the group, round and pick, who is on the clock, a large countdown from
    `useCountdown`, the latest event in the group, and the ticker.
  - The turn states map to classes `waiting`, `next`, `yours` and `urgent`. The
    `yours` class pulses through a keyframe that is disabled under
    `prefers-reduced-motion: reduce` (the solid accent style stays).
  - When the state enters `yours`, which happens once per pick number, it sets
    `document.title`, calls `navigator.vibrate?.(200)`, and plays a tone if sound is
    on.
  - The tone comes from the Web Audio API (a 0.2 s oscillator), so there is no asset.
    The toggle lives in `localStorage` under `bingo.draft.sound`.
  - The title is restored on unmount and when the state leaves `yours`.
- `RoomPool.tsx` reuses `PoolFilterBar`'s look but drives local state, not the URL.
  It takes a new `onChange` variant: the form submits locally instead of navigating.
  `SubmissionList` gets a `renderActions` variant for queue and Draft buttons. The
  list pages through 100 rows at a time with "Show more", and has an "Include drafted
  squares" checkbox.
- `RoomQueue.tsx` reuses `QueueList` with a new optional `rowAction` render prop
  (Draft). It is keyed by the queue ids from room state. Adding and removing call the
  queue routes and update room state when they succeed (the queue toggle gets an
  `onChanged` callback variant).
- `DraftConfirm.tsx` uses `Dialog`. It names the square and has Draft it and Cancel.
  - In flight, the button shows loading.
  - It closes with a message if `turnState` leaves `yours` while open.
  - On a refusal, it shows `reasonMessage` and calls `resync()`.
- `RoomPicks.tsx`: My picks plus `GroupGrid` with a group selector.
- `GroupGrid.tsx` is a `<table>` with round rows and player columns. The current cell
  has `aria-current`, and auto-picks are marked.
- The league layout's SubNav adds Draft when status is not `pre_draft`. The overview
  gets a "Go to the draft room" `ButtonLink` while drafting.

## Dev Scenario
`draft_your_turn`: as `draft_started` (15 in 3 groups, queues), with bots on and a
settle right after seeding (`settleLeague`), so the bots pick until the viewer's turn.
Groups with no real player finish at once. Add it to `scenarios.ts` (`devBots: true`,
plus a new `settleAfterSeed: true` field).

## Testing Plan
- **Property tests** (fast-check, at least 100 runs):
  - `applyEvents` is idempotent and ignores `seq <= lastSeq`.
  - Applying a pick stream in order gives the same groups as a snapshot taken after
    it. (The model `settle` in `lib/draft/engine.ts` generates the streams.)
  - `availablePool` never includes a square picked in your group and always includes
    one picked only elsewhere.
  - `filterPool` gives the same result as the server's filter rules on random rows
    (case, `none`, search characters such as `%` and `_`, stable ties).
  - `groupGrid` places each pick at the cell `onClock` says.
- **Example tests:** `turnState` for each state, `titleFor`, `whereTaken` text.
- **Route tests:** `/draft/state` for validation, 401, 404 for a non-member, and the
  shape.
- **Component tests (jsdom, mocked feed and fetch):**
  - The banner states: the `yours` class, the title, a single vibrate per pick
    number, the urgent state under 10 s, `next`, and reduced motion (no pulse class).
  - The confirm flow: success, each refusal with a resync, and the turn ending while
    the dialog is open.
  - Draft buttons are disabled when it is not your turn.
  - Pool filtering, "Show more", and "Include drafted squares" with the where-taken
    text.
  - The queue drops a square when its event arrives.
  - The grid places picks.
  - The room applies a live event without fetching.
  - Not started, and complete.
- **Integration** (`test/integration/draftRoom.integration.test.ts`):
  - `readRoomSnapshot` returns `lastSeq` consistent with its picks (a pick made
    concurrently is either in the picks with its seq at or below `lastSeq`, or
    neither).
  - It returns only the caller's queue.
  - It refuses a non-member.
- **Manual (the user):**
  - The alert on laptop and phone (`draft_your_turn`), and a pick from the queue and
    from the pool.
  - Two tabs as different players.
  - Reduced motion.
  - 360px and desktop width.

## Steering Updates
- `conventions.md`: the snapshot route exception (consistency with `lastSeq`).
- `structure.md`: `lib/draftRoom/`, `components/draftRoom/`, the route and the page.
- `design-system` note: tabs on phones instead of a queue bottom sheet.
- `roadmap.md`: the status and the F9 handoff (banner, ticker and snapshot to reuse).
