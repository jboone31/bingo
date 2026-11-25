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

- Admin sets the draft date at creation and can change it before the start.
- CSV upload (submission text, submitter, category), with clear errors for bad rows.
- Add a single submission.
- Edit, remove, and recategorize submissions during pre-draft.
- Creating a league with no CSV gives an empty pool.

Decided: submitter names are always visible to players, so no column hiding is
needed in the pool read path.

Open: duplicate handling on upload, whether a re-upload replaces or appends.

## F4: Pre-draft pool and queue

- Navigation between pre-draft views (pool, queue, league info).
- Browse the pool with filter and sort by category.
- Add a submission to the personal queue from the pool.
- Drag to re-rank the queue, usable on touch screens.
- Show the draft date to everyone.
- The pool browser (filter and sort) and the draggable queue are shared components in
  `components/`, built here and reused by the draft room in F8.

## F5: Realtime and event log

- An append-only, ordered event log for league and draft activity.
- Subscribing clients fold events into one view, with reconnect and catch-up.
- Access rules so members see their league's events. The event log ships with
  league-level events only. F7 adds group-scoped events and their access rules once
  draft groups exist (F6).
- A shared way for clients to know server time.

Decided: group scoping is deferred to F7. F5 does not depend on F6.

Open: how groups map onto channels and access rules (answered in F7).

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

## F8: Draft room UI

- Remaining submissions with filter and sort, and an add-to-queue action.
- Queue shown as a sidebar, or a bottom sheet on mobile, editable during the draft.
- My picks so far, and confirmed picks of other players. Own group is shown apart from
  other groups.
- Search the pool to find where a square ended up.
- Turn indicator and countdown. The round-to-square mapping is not shown.
- A live banner with the latest event.

Open: whether the banner is group-wide or league-wide.

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
