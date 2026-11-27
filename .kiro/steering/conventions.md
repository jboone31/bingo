# Conventions

Cross-feature rules so every feature fits together. If a spec needs to break one,
say so in the spec and update this file.

## Access Model

- **Reads**: the browser reads through Row-Level Security (RLS) using the signed-in
  user's session, and subscribes to Realtime on tables it is allowed to read.
- **Writes**: the browser never writes to the database directly. Every write goes
  through a server route that uses postgres.js in a transaction.
- Authenticated users get **select policies only**. No insert, update or delete
  policies exist for them.
- Server routes authorize in TypeScript and in the database: confirm the session,
  then check league membership or admin role against current data inside the same
  transaction as the write.
- Data that must stay private (a player's queue is visible only to them) gets a
  select policy that matches its owner, not the whole league.
- If a read needs shaping that a policy cannot give (for example hiding a column),
  use a server route or a view, and record the reason in the spec.

## RLS Policies

- Enable RLS on every table in the same migration that creates it.
- Express membership with a small set of shared helper functions, for example "is
  this user a member of this league" and "is this user in this draft group". Policies
  call the helpers rather than repeating subqueries.
- Helper functions are `security definer` with a fixed `search_path`, so they do not
  recurse into the policies they serve.
- Write `(select auth.uid())` rather than a bare `auth.uid()` in policies so Postgres
  evaluates it once per query.
- Index every column a policy filters on.
- A new table needs an explicit `grant select ... to authenticated`. This project does
  not grant new tables to API roles by default, so a policy alone gives "permission
  denied" (see migration 0003). Revoke everything from `anon` and `authenticated`
  first, then grant select only.
- A table that clients subscribe to must be added to the Realtime publication in its
  migration.
- Every table with policies gets live integration tests that confirm a member can
  read, a non-member cannot, and no direct write succeeds.

## Database

- Tables are plural snake_case (`leagues`, `league_members`). Columns are snake_case.
- Primary keys are `uuid` with a database default. Foreign keys are named
  `<singular>_id` (`league_id`).
- All timestamps are `timestamptz`, stored in UTC. Every table has `created_at`.
- The database clock is the only clock that decides anything time-based, such as
  pick deadlines. Client clocks are used only to display countdowns.
- Tables owned by a league reference it with `on delete cascade`, so deleting a
  league removes everything it owns.
- Private per-player data (a queue) uses an owner select policy, and composite foreign
  keys that tie each row to the player's league membership and to rows in the same
  league, so leaving or deleting cascades and cross-league references are impossible.
- Other tables point at a submission by its `id`. Never rely on submission text
  being unique: duplicates are allowed by design.
- Prefer constraints and unique indexes over application checks for rules the data
  must always satisfy.
- Migrations are numbered `NNNN_name.sql`, each in its own `begin; ... commit;`.
  Never edit a migration that has been applied; add a new one.
- Functions that mutate data are executable only by the server role. Revoke execute
  from `public`, `anon` and `authenticated`.

## Server Routes

- Route handlers live under `app/api/` and use the Node.js runtime.
- Order of work: validate input, authenticate, authorize, run one transaction, return.
- Validate all input at the route boundary. Reject unknown or malformed values.
- Return a stable JSON shape with a machine-readable reason on failure. Never return
  raw database errors or connection details.
- Routes are thin. Rules live in `lib/` as pure functions the route calls.
- Anything a client might trigger twice (a pick, a nudge, a double-click) must be
  safe to repeat. Creates that a double-click could duplicate carry a client request id
  (`newRequestId()`) stored under a unique constraint.
- A write that depends on league status first locks the league row in the same
  transaction: `for update` (`lib/leagues/guard.ts`), or for member-level writes such as
  queue changes `for share` plus the member's own row (`lib/queue/queries.ts`). The draft
  start locks it `for update`, so it cannot interleave with either.
- Unexpected errors are logged on the server as `[api] unexpected error: ...` (name,
  database code, message; no stack) and returned as `internal_error` with no detail.

## Events

- Every route that changes league data appends one event to `league_events` with
  `appendLeagueEvent` (`lib/events/append.ts`), inside the same transaction and after
  the change, and only when something actually changed (a no-op repeat adds nothing).
- Build events with the builders in `lib/events/payload.ts`. Payloads hold display
  names and counts only, never join codes, CSV rows or emails. Add a sentence for each
  new type in `lib/events/describe.ts`.
- `seq` is per league, gap-free, assigned under the league row lock by
  `append_league_event`. Clients order, dedupe and detect holes by `seq` only, through
  `foldEvents` (`lib/events/fold.ts`). Never order events by `created_at`.
- Browser code subscribes with `useLeagueEvents` (`components/realtime/`), which
  subscribes before it reads and catches up after reconnects, holes and quiet periods.
- Countdowns use `useServerNow()` (`ServerClockProvider`, mounted in the signed-in
  layout), never the raw client clock.
- With postgres.js, bind JSON as text and cast `$n::text::jsonb`. A string bound to
  `$n::jsonb` is stored as a JSON string, not an object.

## Code Layout

- `lib/<area>/` holds framework-free logic for one domain area, with its tests beside
  it. It does not import from `app/` or React.
- `app/` holds pages and routes. Shared React components go in `components/`, created
  by the first feature that needs one.
- Imports use the `@/` alias for repo-root paths.
- Server-only modules import `server-only` so a client import fails the build.

## Client Code

- Do not call `crypto.randomUUID()` in browser code: a phone on `http://<LAN IP>` is not
  a secure context. Use `newRequestId()`.
- Text rendered on the server must not come from `Intl`; Node and browsers format it
  differently and hydration fails. Use `LocalTime` (UTC placeholder, then the viewer's
  zone) or `formatUtcStable`.
- A library that numbers DOM ids from a module counter needs a stable `id` (`useId()`).
- Touch drag uses a press-and-hold `TouchSensor`. Never `PointerSensor`, and never
  `touch-action: none` on a handle (`components/queue/sensors.ts`, with a guarding test).
- Respond to a click at once and confirm with the server (optimistic), rolling back
  with a message on failure. Save repeated changes one request at a time
  (`lib/queue/saver.ts`).

## Testing

- Pure rules (snake order, group split, start gate, board mapping, CSV parsing,
  timer settlement decisions) get fast-check property tests in addition to examples.
- Default tests are offline. Anything that needs the database goes in
  `test/integration/`.
- Route tests mock the session and the query modules (`test/helpers/leagueRoutes.ts`).
  Component and page tests opt into jsdom with `// @vitest-environment jsdom`.
- Integration suites run against the one live project, so they create their own data
  with `test/integration/helpers` and clean up. Those that use the service-role key
  (`devTools`) are run by the user.
- A test must fail for the reason it names: reproduce a bug in a failing test before
  fixing it where practical.
- Add tests when the spec's tasks call for them.

## Design

- Styles use tokens from `app/tokens.css` only: no hard-coded colors, font families
  or one-off sizes in component styles (a test enforces colors and fonts).
- Build screens from `components/ui/` and `components/shell/`. Add a variant to a
  shared component rather than styling around it.
- Follow the layout rules and wireframes in `.kiro/specs/design-system/`: mobile
  first, 44px touch targets, dark forced on the draft room and big screen.
- Show timestamps with `LocalTime` or `formatDateTime` so viewers see their own time
  zone.

## Dev Scenarios

- Each feature lists the states it needs to be tested in (for example "pool full,
  ready to start") and adds them as entries in `lib/dev/scenarios.ts`, run by
  `lib/dev/seedScenario.ts`. The `/dev` page and routes read that registry.
- Every dev entry point goes through `isDevToolsEnabled()`: `ENABLE_DEV_TOOLS=1` and
  `VERCEL_ENV` not `production`. Never set the flag on Vercel Production.
- Dev code touches only leagues with a `seed_scenario` tag and users that pass
  `isSeedUser` (reserved `seed-player-NNN@bingo-seed.test` email and a seed flag).
  Scenarios build state through the real tables and triggers.
- UI behavior is checked against a seeded scenario, not by building a league by hand.

## Done Means

A feature is done when `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm test` and `npm run build` pass, integration tests for any new tables or policies
pass, the feature's dev scenarios exist, and `structure.md` and `roadmap.md` reflect the change.
