# Tech

## Locked Stack

- **Runtime and framework**: Node.js 26 with Next.js (App Router) in TypeScript.
  Vercel supports Node 26; `engines.node` is `26.x` and `.nvmrc` pins 26.
- **Hosting**: Vercel for the app and its serverless routes.
- **Backend**: Supabase for managed Postgres, Realtime, and Auth. Google is the sign-in
  provider.
- **Scheduling**: `pg_cron` inside Supabase, used for the draft timer backstop.
- **Language tooling**: TypeScript 6.x. TypeScript 7 is not used yet because
  `typescript-eslint` does not support it. Revisit when it does.
- **Quality tooling**: ESLint (flat config, Next + TypeScript rules), Prettier owns
  formatting.
- **Testing**: Vitest as the runner, fast-check for property-based tests, Testing
  Library (with `user-event`) and jsdom for component and page tests.
- **Drag and drop**: `@dnd-kit` (core, sortable, utilities) for the re-orderable queue.
  It supports touch, mouse and keyboard.

## Data Access

- **postgres.js** (`lib/db/server.ts`) for server writes that must be transactional.
  A pick, its side effects, and the event announcing it commit or roll back together.
  Uses the Supabase pooler in transaction mode on Vercel.
- **@supabase/supabase-js and @supabase/ssr** (`utils/supabase/`) for auth sessions,
  RLS-scoped browser reads, and Realtime subscriptions.
- The service-role key and database URL are server-only and never reach the browser.
- Row-Level Security is the access boundary for anything the browser reads directly.
  Members of a league see that league's data; a draft group's players see their own
  group's events.

## Real-Time Approach

- Draft changes are written to an append-only, ordered event log in Postgres.
- Clients subscribe through Supabase Realtime and fold events into one client view,
  so the first load, reconnects, and live updates all agree.
- On reconnect or a quiet period, clients fetch events they missed after the last one
  they applied.

## Draft Timer Approach

The server decides when a turn ends. Serverless functions cannot hold timers, so
deadlines are data.

- Each turn stores a deadline timestamp. Clients render countdowns against server
  time using a measured clock offset.
- One idempotent settle operation claims an expired turn with a conditional update
  under a row lock and performs the auto-pick, so concurrent callers cannot
  double-fire. It repeats until the current turn is not expired.
- Several independent callers trigger it: connected clients shortly after a deadline,
  every pick or queue write before it proceeds, and a seconds-level `pg_cron` job as
  a backstop when nobody is connected.
- The auto-pick and its event always commit together.

## Identity

Persistent Google accounts through Supabase Auth, with an optional display name.
A player has one account and can belong to many leagues. League membership and role
are data, not session state.

Supabase sends users back only to URLs on its Redirect URLs allowlist. Add each origin
that signs in (`localhost:3000`, the production domain). A LAN address was rejected
even with exact entries (cause unknown), so phone testing uses the dev-only sign-in.

## Testing Philosophy

- Domain logic is framework-free, lives in `lib/`, and is covered by unit tests and
  fast-check property tests (at least 100 runs per property). Snake order, balanced
  group splits, the start gate, board position mapping, and timer settlement are the
  main candidates.
- Tests sit next to the code they cover. Cross-cutting checks live in `test/`.
- `npm test` is hermetic: no network, no database, no env files.
- Live database suites live in `test/integration/` and run only through
  `npm run test:integration`, which loads `.env.local`.
- Do not add tests unless the task or spec calls for them.

## Environments And Secrets

- Real env files are git-ignored; `.env.example` documents every variable.
- Env is read through `lib/env` so a bad deployment fails with a message that names
  every missing variable.
- **One Supabase project serves dev, preview and production.** There is no separate dev
  database, so dev tooling is gated by `ENABLE_DEV_TOOLS` (never on Production) and
  touches only tagged seed data.
- Schema changes are numbered SQL files in `supabase/migrations/`, applied in order
  by `npm run db:migrate`, which records what has run and is safe to re-run.

## Open Technical Questions

- How draft groups map onto Realtime channels and RLS policies.
- Whether PNG export is done in the browser or on the server.

---

_Keep this file at the level of decisions and approach. Mechanics belong in each
feature's design._
