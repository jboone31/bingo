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
  safe to repeat.

## Code Layout

- `lib/<area>/` holds framework-free logic for one domain area, with its tests beside
  it. It does not import from `app/` or React.
- `app/` holds pages and routes. Shared React components go in `components/`, created
  by the first feature that needs one.
- Imports use the `@/` alias for repo-root paths.
- Server-only modules import `server-only` so a client import fails the build.

## Testing

- Pure rules (snake order, group split, start gate, board mapping, CSV parsing,
  timer settlement decisions) get fast-check property tests in addition to examples.
- Default tests are offline. Anything that needs the database goes in
  `test/integration/`.
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
  ready to start") and adds them as seed scenarios in `scripts/seed/`.
- Dev-only routes, seeds and the "act as" switcher run only when an explicit env flag
  is set and never in production. Seeded rows are tagged so reset removes only them.
- UI behavior is checked against a seeded scenario, not by building a league by hand.

## Done Means

A feature is done when `npm run typecheck`, `npm run lint`, `npm run format:check`,
`npm test` and `npm run build` pass, integration tests for any new tables or policies
pass, the feature's dev scenarios exist, and `structure.md` and `roadmap.md` reflect the change.
