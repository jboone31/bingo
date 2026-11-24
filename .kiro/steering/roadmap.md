# Roadmap

Features in dependency order. Each one becomes its own spec (requirements, design,
tasks) under `.kiro/specs/`. This list says what each feature covers and what it
needs. It does not say how to build it.

Behavior rules live in `draft-rules.md`. Update the status column as specs are
written and features ship.

| #   | Feature                         | Depends on     | Status      |
| --- | ------------------------------- | -------------- | ----------- |
| F0  | Foundation (scaffold, steering) | none           | Done        |
| F1  | Auth and profiles               | F0             | Not started |
| F2  | Leagues                         | F1             | Not started |
| F3  | Pool administration             | F2             | Not started |
| F4  | Pre-draft pool and queue        | F2, F3         | Not started |
| F5  | Realtime and event log          | F2             | Not started |
| F6  | Draft setup and start           | F3, F4         | Not started |
| F7  | Draft engine and timers         | F5, F6         | Not started |
| F8  | Draft room UI                   | F7             | Not started |
| F9  | Live feed and big screen        | F7             | Not started |
| F10 | Board generation                | F7             | Not started |
| F11 | Board view and export           | F10            | Not started |

## F0: Foundation (done)

Next.js app on Node 26, Supabase connection and migration runner, env validation,
health route, test tooling, and these steering files.

## F1: Auth and profiles

- Sign in with Google through Supabase Auth.
- A profile per user with an optional display name, editable later.
- Session handling across server and browser, and protected routes.
- Sign out.

Open: what name shows when a display name is not set.

## F2: Leagues

- Home screen listing the player's active leagues, with actions to join or create.
- Create a league. The creator becomes admin.
- Invite by link or join code. Joining adds the player as a regular member.
- A league view that shows the pre-draft flow until the draft starts.
- Block joining once the draft has started.

Open: admin transfer, league deletion, whether the admin plays.

## F3: Pool administration

- Admin sets the draft date at creation and can change it before the start.
- CSV upload (submission text, submitter, category), with clear errors for bad rows.
- Add a single submission.
- Edit, remove, and recategorize submissions during pre-draft.
- Creating a league with no CSV gives an empty pool.

Open: duplicate handling on upload, whether a re-upload replaces or appends.

## F4: Pre-draft pool and queue

- Navigation between pre-draft views (pool, queue, league info).
- Browse the pool with filter and sort by category.
- Add a submission to the personal queue from the pool.
- Drag to re-rank the queue, usable on touch screens.
- Show the draft date to everyone.

## F5: Realtime and event log

- An append-only, ordered event log for league and draft activity.
- Subscribing clients fold events into one view, with reconnect and catch-up.
- Access rules so members see their league and group players see their own group's
  events.
- A shared way for clients to know server time.

Open: how groups map onto channels and access rules.

## F6: Draft setup and start

- Admin sets the group count, changeable during pre-draft.
- Admin sets the per-pick timer (default 60 seconds).
- The minimum pool size, `ceil(N / G) x 25`, is shown live and blocks the start.
- Start with an explicit confirmation.
- On start: lock joining, split members into balanced random groups, give each group
  its pool copy, and set random snake order per group.

## F7: Draft engine and timers

- Turn order per group, a deadline per turn, and picks that respect availability.
- One idempotent settle operation for expired turns, including cascades across
  several expired turns.
- Auto-pick from the queue, else random.
- Triggers: client nudges, every pick or queue write, and a seconds-level `pg_cron`
  backstop.
- Draft completion per group, and detection that all groups are done.

## F8: Draft room UI

- Remaining submissions with filter and sort, and an add-to-queue action.
- Queue shown as a sidebar, or a bottom sheet on mobile, editable during the draft.
- My picks so far, and confirmed picks of other players. Own group is shown apart from
  other groups.
- Search the pool to find where a square ended up.
- Turn indicator and countdown.
- A live banner with the latest event.

Open: whether the banner is group-wide or league-wide.

## F9: Live feed and big screen

- A fuller feed of recent events across groups.
- A full-screen mode built for a shared display.

## F10: Board generation

- Runs when all groups are done.
- Round-1 pick goes in the center. Other rounds map to positions at random, the same
  for every player.
- Boards are stored so they do not change after generation.

Open: whether the random mapping is per league or per group.

## F11: Board view and export

- A view of the player's generated card.
- Export the card as a PNG.
- Export the full draft results as CSV.

Open: who can download the full CSV (admin only, or everyone).
