---
inclusion: auto
name: roadmap
description: The ordered feature list (F0 to F11) with scope, dependencies, status and open questions for each feature. Use when starting, planning or speccing a feature, or when checking what is built or what comes next.
---

# Roadmap

Features in dependency order. Each one becomes its own spec (requirements, design,
tasks) under `.kiro/specs/`. This list says what each feature covers and what it
needs. It does not say how to build it.

Behavior rules live in `draft-rules.md`. Update the status column as specs are
written and features ship.

## Starting A Feature

1. Read the feature's section below and the features it depends on.
2. Resolve that feature's **Open** questions with the user before writing
   requirements. Record each answer in the spec, and in `draft-rules.md` or
   `product.md` if it changes a rule.
3. Follow `conventions.md` for access, database, routes and testing. For timers,
   realtime or the event log, also read `reference-bbb.md`.
4. List the dev scenarios the feature needs (see `conventions.md`, Dev Scenarios)
   and include building them in the tasks.
5. Create the spec at `.kiro/specs/<feature-name>/`.
6. When the feature ships, set its status here and update `structure.md` if the
   layout changed.

| #   | Feature                         | Depends on     | Status      |
| --- | ------------------------------- | -------------- | ----------- |
| F0  | Foundation (scaffold, steering) | none           | Done        |
| F1  | Auth and profiles               | F0             | Done        |
| F1.5 | Design system and app shell    | F1             | Done        |
| F2  | Leagues                         | F1.5           | Done        |
| F2.5 | Dev tooling and seed scenarios | F2             | Done        |
| F3  | Pool administration             | F2             | Done        |
| F4  | Pre-draft pool and queue        | F2, F3         | Done        |
| F5  | Realtime and event log          | F2             | Done        |
| F6  | Draft setup and start           | F3, F4         | Not started |
| F7  | Draft engine and timers         | F5, F6         | Not started |
| F8  | Draft room UI                   | F7             | Not started |
| F9  | Live feed and big screen        | F7             | Not started |
| F10 | Board generation                | F7             | Not started |
| F11 | Board view and export           | F10            | Not started |

## Status And Handoff

Built and committed: **F0 to F5**. Nothing is half done. The working tree is clean.

**Next: F6 (Draft setup and start).** Its spec does not exist yet. Settle its open
questions with the user first (see the F6 section).

F5 manual checks (`realtime-events` 6.3 to 6.6: Activity list, two-tab live updates,
offline catch-up, 360px) have not been confirmed by the user.

**Manual checks still unticked** in the specs (the user tested most flows informally
but has not confirmed these):
- `design-system` 7.1: gallery in light and dark, keyboard only, reduced motion. 7.2:
  sign-in, profile edit and sign out end to end (almost certainly fine, since the user
  signs in daily, but never explicitly confirmed).
- `dev-tooling` 6.2: `/dev` returns 404 with the flag unset.
- `leagues` 6.2, `pool` 6.2, `queue` 7.5: layouts at 360px and desktop width.
- `queue` 7.1 to 7.4: filters, queue buttons, drag on laptop and phone, two-tab check.
  Drag worked on desktop. On the phone it was reworked (press-and-hold touch drag, one
  finger only, edge scrolling) and a hydration error was fixed; neither fix has been
  re-confirmed on the phone.

**Open threads, none blocking:**
- Supabase rejects the LAN address as a sign-in redirect even with exact allowlist
  entries. Unexplained. The phone uses "Dev sign-in" instead.
- One 500 on `PATCH /api/leagues/[leagueId]` (draft date) happened once and did not
  recur. Unexpected route errors are now logged on the server.
- `devTools.integration.test.ts` has not been run by an agent (needs the service-role
  key; see `workflow.md`).
- League names show in capitals because headings are styled that way. The user was
  asked whether to show them as typed; no answer yet.
- Optional, not built: "Move to top" or "move to position" for long queues.
- Decided to skip for now: attempt limits on join codes.
- Still open product questions: whether the draft date does anything beyond display;
  F8 banner scope; F11 who can download the CSV; PNG export in browser or on the server.

**Building blocks to reuse, not rebuild:** `lib/api` (`handle`, `handlePublic`,
`readJsonObject`, `parseUuid`, `ok`/`fail`); `lib/leagues/guard.ts` (`assertAllowed`,
`lockLeagueForMember`); `lib/queue/queries.ts` (`lockMemberForQueue`); `lib/ids`
(`newRequestId`); `lib/format` and `LocalTime`; `lib/pool/csv.ts` (`serializeCsv`);
`components/leagues/ConfirmAction`, `components/ui/*` (including `Pagination` with
`params`), `components/pool/*`, `components/queue/*`; `test/helpers/leagueRoutes.ts`
(route test mocks); `test/integration/helpers` (users, leagues, `asRole`, cleanup);
`lib/dev/scenarios.ts` (add each feature's seed scenarios here).

## F0: Foundation (done)

Next.js app on Node 26, Supabase connection and migration runner, env validation,
health route, test tooling, and these steering files.

## F1: Auth and profiles

- Sign in with Google through Supabase Auth.
- A profile per user with an optional display name, editable later.
- Session handling across server and browser, and protected routes.
- Sign out.

Decided: the profile stores the Google full name at first sign-in (else
`Player xxxx`). See `.kiro/specs/auth-and-profiles/`.

## F1.5: Design system and app shell

- Design tokens (color, type, spacing) and a CSS approach, chosen once.
- Shared components in `components/`: buttons, inputs, cards, dialogs, toasts,
  empty, loading and error states.
- App shell with navigation, signed-in header, and a URL scheme for league pages.
- Mobile-first layout rules, plus the rules for the big-screen view.
- Rough wireframes (markdown or ASCII) for home, league, pre-draft, draft room, big
  screen and board. Per-feature layout detail stays in each feature's spec.
- Shared date and time formatting: times are stored as `timestamptz` and shown in
  each viewer's own time zone.
- Restyle the F1 screens (sign-in, profile, home) with the new components.

Decided: CSS Modules with CSS variables, sports-draft broadcast look, follows the
system light/dark setting. See `.kiro/specs/design-system/`.

## F2: Leagues

- Home screen listing the player's active leagues, with actions to join or create.
- Create a league. The creator becomes admin.
- Invite by link or join code. Joining adds the player as a regular member.
- A league view that shows the pre-draft flow until the draft starts.
- Block joining once the draft has started.
- League status, one field used by every later feature: `pre_draft`, `drafting`,
  `in_progress`. Enforced in the database. Changes only move forward.
- Players can leave a league during `pre_draft`. The admin cannot leave without first
  transferring admin or deleting the league.
- Admin transfer to another member, if it stays small (one transaction, one route).
  Not required for the MVP.
- First task: extract `lib/api/` (JSON body parsing, the `{ ok, reason }` response
  shape, an auth wrapper) from the F1 routes, and use it for every new route.

Decided: the admin also plays, so they count in `N`. See `draft-rules.md`.

Decided: the admin can delete a league only while `pre_draft`, by typing its name.
The admin can remove members pre-draft. Join codes are 8 characters with no attempt
limit for now. See `.kiro/specs/leagues/`.

## F2.5: Dev tooling and seed scenarios

- A `/dev` page that builds a league in a chosen state: empty, with players, full,
  or viewed as a regular member. Scenarios are data in `lib/dev/scenarios.ts`, and
  each feature adds the states it introduces.
- Fake users and a dev-only "act as" switcher, so one person can test several roles
  without Google accounts.
- Reset one scenario league without touching real data.
- Safety: dev routes and seeds run only with an explicit env flag, never in
  production, and touch only rows tagged as seed data.
- Shared integration-test helpers already exist in `test/integration/helpers/`
  (created in F2); extend them into the seed tooling.
- F2 scenarios to build: `league_empty` (admin only), `league_with_players` (admin
  plus 11 members and a draft date), `league_full` (100 members), `member_view` (the
  viewer is a regular member).

Decided: one Supabase project, no separate dev database. The safety rules above
are therefore mandatory, and seeded users and leagues are tagged so they can be
removed cleanly.

## F3: Pool administration

- Draft date: set at creation and editable by the admin in league settings before
  the start. Built in F2; nothing more to do here.
- CSV upload (submission text, submitter, category), with clear errors for bad rows.
- Add a single submission.
- Edit, remove, and recategorize submissions during pre-draft.
- Creating a league with no CSV gives an empty pool.

Decided: submitter names are always visible to players, so no column hiding is
needed in the pool read path.

Decided: duplicates are allowed and every submission has a unique row id. A re-upload
appends. Uploads are all or nothing and safe to repeat. The admin can edit and delete
single rows, or clear the pool. See `.kiro/specs/pool/`.

## F4: Pre-draft pool and queue

- Navigation between pre-draft views (pool, queue, league info).
- Browse the pool with filter and sort by category.
- Add a submission to the personal queue from the pool.
- Drag to re-rank the queue, usable on touch screens.
- Show the draft date to everyone.
- The pool browser (filter and sort) and the draggable queue are shared components in
  `components/`, built here and reused by the draft room in F8.

Decided: category filter ignores capitalization, plus text search and sort; queues
hold individual rows (200 max), are private to their owner, and are cleaned up when a
square, member or league is deleted; re-ordering by drag handle and by buttons; editable
while `pre_draft` (F7 extends it). See `.kiro/specs/queue/`.

## F5: Realtime and event log

- An append-only, ordered event log for league and draft activity.
- Subscribing clients fold events into one view, with reconnect and catch-up.
- Access rules so members see their league's events. The event log ships with
  league-level events only. F7 adds group-scoped events and their access rules once
  draft groups exist (F6).
- A shared way for clients to know server time.

Decided: group scoping is deferred to F7. F5 does not depend on F6.

Decided: one table, `league_events`, with a gap-free per-league `seq` assigned under the
league row lock; events appended in the change's transaction, only when something
changed; names copied into payloads; event types are open (a format check); all events
kept. Server time from `GET /api/time` and `useServerNow()`. First consumer: the
overview's Activity list (latest 50), which refreshes the page on new events. See
`.kiro/specs/realtime-events/`.

Open: how groups map onto channels and access rules (answered in F7).

From earlier features:
- Nothing subscribes to Realtime yet, and no table is in the publication. Add each
  subscribed table to the publication in its own migration (`conventions.md`).
- Mutation points that could emit league events today: `app/api/leagues/**` (join,
  leave, remove, transfer, join-code, draft date, delete) and the submissions routes.
- Server time: `reference-bbb.md` has the offset pattern. Existing time display is
  display only (`LocalTime`).

## F6: Draft setup and start

- Admin sets the group count, changeable during pre-draft.
- Admin sets the per-pick timer (default 60 seconds).
- The minimum pool size, `ceil(N / G) x 25`, is shown live and blocks the start.
- Start with an explicit confirmation.
- On start: set the league status to `drafting` (which locks joining), split members
  into balanced random groups, and set random snake order per group. The pool is not
  copied: each group drafts from the league's submissions, and availability is the
  absence of a pick in that group.
- A league with fewer members than groups cannot start.

From earlier features:
- The start must lock the league row `for update`. Pool writes lock it the same way,
  and queue writes hold it `for share`, so the start cannot interleave with either.
  Joining is already blocked by `league_members_guard`.
- Setting `drafting` already freezes the pool (`submissions_guard`), membership
  (`league_members_guard`, and the leave and remove rules) and queues
  (`queue_items_guard`) in the database. F7 must loosen the queue guard.
- Group count and pick timer need new columns (a new migration). `N` includes the admin.
- Dev scenarios: add "pool ready to start" variants as needed (`pool_ready` exists).

## F7: Draft engine and timers

- Turn order per group, a deadline per turn, and picks that respect availability.
  A pick is unique on `(group_id, submission_id)`, so the database refuses a second
  pick of the same square in one group.
- Group-scoped events and their access rules, and the answer to how groups map onto
  Realtime channels.
- One idempotent settle operation for expired turns, including cascades across
  several expired turns.
- Auto-pick from the queue, else random.
- Triggers: client nudges, every pick or queue write, and a seconds-level `pg_cron`
  backstop.
- Draft completion per group, and detection that all groups are done. The last pick
  of the last group calls board generation (F10) in the same transaction.
- Dev controls (dev flag only): shorten the pick timer, expire the current deadline
  on demand, and let bots pick for chosen players, so the draft room can be tested
  without waiting.

From earlier features:
- F5 built the event log (`lib/events/`, `league_events`). Draft events can use the
  same table and `appendLeagueEvent`, or a group-scoped table with its own policy; both
  keep the per-scope gap-free `seq`. In F5 the client does **not** derive state from
  events (it refreshes server data). If the draft room derives state from events, the
  50-event first load is not enough: load a snapshot plus the `seq` it reflects, then
  apply later events, or load the whole group log (bounded at 25 x group size). Decide
  in the F7 spec, and revisit retention.
- Countdowns: use `useServerNow()` from `components/realtime/ServerClockProvider.tsx`.
  Nudge responses can also carry `now` to refine the offset.
- Queues must stay editable during the draft. Replace `queue_items_guard` in a new
  migration so `drafting` is allowed, and update `canEditQueue` and `canAddToQueue` in
  `lib/queue/rules.ts` and the tests that expect 409 `league_not_pre_draft`.
- The pool stays frozen. Picks reference `submissions.id`; never assume text is unique.
- Server code connects as the database owner, so settle and auto-pick can read every
  player's queue despite the owner-only policy (integration tests rely on this).
- Decide whether a picked square leaves each player's queue in the same group.
- `pg_cron` is already enabled (migration 0001). Routes that trigger settle should use
  `handle`, carry request ids where a repeat could matter, and lock the league row.
- Add draft-state seed scenarios (mid-draft, expired deadline) and the dev controls.

## F8: Draft room UI

- Remaining submissions with filter and sort, and an add-to-queue action.
- Queue shown as a sidebar, or a bottom sheet on mobile, editable during the draft.
- My picks so far, and confirmed picks of other players. Own group is shown apart from
  other groups.
- Search the pool to find where a square ended up.
- Turn indicator and countdown. The round-to-square mapping is not shown.
- A live banner with the latest event.

Open: whether the banner is group-wide or league-wide.

From earlier features:
- Reuse `PoolFilterBar` (takes a `basePath`), `SubmissionList`, `Pagination`,
  `QueueList` and `QueueToggle`. `QueueList` starts over when its `key` changes; the
  queue page keys it by the server's item ids.
- Force dark with `data-theme="dark"` (see `.kiro/specs/design-system/`).
- Drag on touch uses a press-and-hold (`components/queue/sensors.ts`).

## F9: Live feed and big screen

- A fuller feed of recent events across groups.
- A full-screen mode built for a shared display.

## F10: Board generation

- Runs in the same transaction as the final pick of the last group. It also moves
  the league from `drafting` to `in_progress`, so boards exist the moment the draft
  ends.
- Round-1 pick goes in the center. Other rounds map to positions at random, once
  per league, the same for every player.
- The mapping is generated at this point, not at draft start, and is hidden until
  then, so nobody can draft around it.
- Boards are stored so they do not change after generation.

Decided: the mapping is per league and stays hidden until boards are generated.

## F11: Board view and export

- A view of the player's generated card.
- Export the card as a PNG.
- Export the full draft results as CSV.

Open: who can download the full CSV (admin only, or everyone).

From earlier features:
- `serializeCsv` (`lib/pool/csv.ts`) quotes cells but does not guard against
  spreadsheet formulas. Neutralize cells that start with `=`, `+`, `-` or `@` in the
  export.
