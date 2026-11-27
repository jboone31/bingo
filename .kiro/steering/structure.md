# Structure

_This file documents the **real** current layout. An automated check
(`test/smoke/structureConsistency.test.ts`) keeps the **Top-Level Layout** block
honest in both directions: every directory named there exists, and every top-level
source directory in the repo is named there. Update the block when you add or remove
a top-level directory._

## Top-Level Layout

```
Bingo/
  app/              # Next.js App Router: pages, layouts, API route handlers
  lib/              # framework-free shared logic (domain rules, data access, env)
  components/       # shared React components
  utils/            # Supabase client factories (browser, server, proxy)
  supabase/         # database migrations
  scripts/          # ops scripts run manually with node (migrations, DB checks)
  test/             # cross-cutting tests not co-located with source
  .kiro/            # steering, specs, hooks
```

Everything else at the root is configuration and tooling, not source: `package.json`,
`package-lock.json`, `tsconfig.json`, `next.config.ts`, `proxy.ts`,
`eslint.config.mjs`, `vitest.*`, `.prettierrc.json`, `.prettierignore`,
`.gitattributes`, `.gitignore`, `.nvmrc`, `.env.example`, `next-env.d.ts`,
`vercel.json` (pins the Next.js framework preset), `README.md`.

## Directory Details

### `app/`

Pages and server route handlers live together under the App Router. API routes are
under `app/api/`. Tests are co-located with the file they cover.

- `tokens.css`: design tokens (colors, type, spacing, motion). `globals.css`: base
  styles.
- `(app)/`: route group for signed-in pages. Its layout renders the app shell. URLs
  do not include `(app)`. `sign-in/` sits outside it and has its own layout.
- `(app)/dev/components/`: component gallery, 404 unless `ENABLE_DEV_TOOLS=1`.

### Routes and pages

All API routes use the Node.js runtime and are built on `lib/api`. Pages sit under the
`(app)` group unless noted.

- **Leagues**: `app/api/leagues/` (create, join), `[leagueId]/` (draft date, delete),
  `[leagueId]/leave`, `[leagueId]/members/[userId]` (remove), `[leagueId]/join-code`,
  `[leagueId]/transfer`, `[leagueId]/draft-settings` (group count, pick timer),
  `[leagueId]/start`. Pages: `leagues/new`, `leagues/join`, `join/[code]`,
  `leagues/[leagueId]` (layout, overview, `settings`).
- **Pool**: `app/api/leagues/[leagueId]/submissions/` (add, clear), `.../import` (CSV,
  with a dry run), `.../[submissionId]` (edit, delete). Page: `leagues/[leagueId]/pool`,
  which reads `?cat=&q=&sort=&page=` (`cat` is `c:<name>` or `none`).
- **Queue**: `app/api/leagues/[leagueId]/queue/` (add, reorder) and
  `.../queue/[submissionId]` (remove). Page: `leagues/[leagueId]/queue`.
- **Draft**: `app/api/leagues/[leagueId]/draft/pick` and `.../draft/settle` (nudge).
  Dev: `app/api/dev/draft` (expire turns, bots).
- **Dev**: `app/api/dev/` (`seed`, `reset` with scope `mine`, `league` or `all`,
  `act-as`, `sign-in`) and the `dev` page, which lists your seed leagues with a Delete
  button each (any status; only leagues with a `seed_scenario` tag you belong to).
  All return 404 unless dev tools are enabled. `sign-in` works without a session and
  also requires a local or private-network host; the sign-in page shows it as
  "Dev sign-in".
- **Auth and profile**: `app/api/auth/callback`, `app/api/auth/sign-out`,
  `app/api/profile`; pages `sign-in` (outside the group, own layout) and `profile`.
- **Time**: `app/api/time` returns the server clock for the client offset estimate.

### URL scheme

```
/                              home: my leagues
/profile
/leagues/new, /leagues/join    create, enter a code
/leagues/[leagueId]            overview
/join/[code]                    invite link
/leagues/[leagueId]/pool | queue | draft | screen | board | settings
```

`draft` is the draft room and `screen` is the big screen.

### `lib/`

Pure domain logic that does not depend on Next.js, so it can be unit- and
property-tested in isolation. Current modules:

- `env/`: environment loading and validation.
- `db/`: the transaction-capable server database helper (server-only).
- `auth/`: sign-in redirect safety, route access rules, server session lookup.
- `profile/`: display name validation, profile read and update.
- `format/`: date and time formatting (viewer's time zone). `formatUtcStable` builds
  server-safe text without `Intl`.
- `ids/`: `newRequestId()`, a UUID that works in insecure browser contexts.
- `api/`: route helpers (`handle`, `readJsonObject`, `parseUuid`, `ok`/`fail`,
  `ApiError`). Server-only.
- `dev/`: dev-only tools: gate, seed identity, scenario registry, seeding, reset and
  act-as. Server parts are server-only. Seed pools use `demo_squares.csv` (real
  squares from earlier years, columns `Text,Submitter,Category`), read by
  `demoSquares.ts` through the pool's CSV import; `next.config.ts` traces it into the
  seed route.
- `pool/`: pool rules and validation (pure: fields, CSV parse and import, paging,
  filter/sort/search parsing in `query.ts`), SQL (`queries.ts`) and RLS reads
  (`read.ts`).
- `queue/`: queue rules, ordering helpers and the order saver (pure), SQL
  (`queries.ts`) and RLS reads (`read.ts`).
- `leagues/`: league rules and validation (pure), SQL (`queries.ts`), RLS reads
  (`read.ts`), and route guards. Player-facing error text is in `messages.ts`.

- `events/`: the league event log. Pure: types, payload builders, `describeEvent`,
  `foldEvents` (order, dedupe, holes), `catchUpPlan`, row conversion and `EventFeed`
  (subscribe, then catch up, coalesced). Server: `append.ts` (`appendLeagueEvent`) and
  `read.ts` (recent events through RLS).
- `time/`: `clockOffset.ts`, the round-trip-midpoint server clock estimate (pure).
- `draft/`: draft settings and the start. Pure: `settings.ts` (ranges, parsing,
  `formatSeconds`), `gate.ts` (`requiredPool`, `groupSizes`, `startGate`), `split.ts`
  (balanced random groups), `rules.ts`. Server: `queries.ts`, `start.ts`
  (`startDraft`, shared by the route and dev seeding) and `read.ts` (groups and
  `getDraftStatus`, RLS). Engine: `engine.ts` (pure model of the SQL engine) and
  `engine.server.ts` (wrappers for the SQL functions, error mapping).

New domain areas (draft, board) get their own folder here.

### `components/`

Shared React components.

- `ui/`: the design system (Button, TextField, Panel, Badge, PageHeader, Dialog,
  Toast, EmptyState, ErrorState, Spinner, Skeleton). Each has a CSS Module and a
  test. Styled only from tokens.
- `dev/`: dev hub, the "acting as" banner and `DevDraftPanel` (dev tools only).
- `pool/`: pool screens' components (list, filter bar, add form, CSV import, row
  actions).
- `queue/`: the queue list (drag and drop) and the add-to-queue button.
- `draft/`: the settings page's `DraftSetupPanel` (fields, live gate, Start with its
  confirmation), the overview's `GateSummary`, `DraftGroups`, `DraftStatus` and
  `Countdown` (server-time countdown that nudges settle).
- `realtime/`: the Supabase event source, `useLeagueEvents`, and
  `ServerClockProvider` (`useServerNow`), mounted in the signed-in layout.
- `leagues/`: league screens' components (cards, forms, member list, invite panel,
  confirm and delete dialogs, the overview's `ActivityFeed`).
- `shell/`: the signed-in frame (AppHeader, UserMenu, PageContainer, SubNav).
- Top level: feature components such as `GoogleSignInButton`, `DisplayNameForm` and
  `LocalTime`.

### `utils/supabase/`

Factories for the Supabase client in each runtime: `client.ts` (browser),
`server.ts` (server components and routes), `middleware.ts` (used by `proxy.ts`).

### `supabase/migrations/`

Numbered SQL files (`NNNN_name.sql`), each wrapped in its own `begin; ... commit;`.
Applied in order by `npm run db:migrate`. All eleven below are applied to the live project.

| File | Adds |
| --- | --- |
| `0001_extensions` | `pg_cron` (enabled; the timer backstop will use it) |
| `0002_profiles` | `profiles`, the sign-up trigger, backfill |
| `0003_profiles_grants` | select grant on `profiles` |
| `0004_leagues` | `leagues`, `league_members`, `is_league_member`, `shares_league_with`, status and member guards |
| `0005_seed_tag` | `leagues.seed_scenario` (dev tools) |
| `0006_submissions` | `submissions`, `submission_imports`, pool guard and 5,000 cap |
| `0007_queue` | `queue_items` (owner-only), its guard, `pool_categories` view |
| `0008_league_events` | `league_events`, `leagues.last_event_seq`, `append_league_event`, Realtime publication |
| `0009_league_events_actor_null` | lets `on delete set null` clear `actor_id` past the immutability trigger |
| `0010_draft_setup` | `leagues.group_count`, `pick_seconds`, `draft_started_at`, settings guard, `draft_groups`, `draft_group_members` |
| `0011_draft_engine` | `draft_clocks`, `draft_picks`, the engine functions, membership and queue guards, `available_submissions` views, the `pg_cron` job |

### `scripts/`

Node scripts run manually against the live Supabase project. They load `.env.local`.

- `apply-migrations.mjs`: apply un-applied migrations, tracked in a
  `schema_migrations` table. Supports `--dry-run` and `--baseline=N`.
- `check-db.mjs`: connectivity check that prints the host, never the password.

### `test/`

- `smoke/`: project-wide checks: the structure consistency check and the design-token
  contrast and no-hard-coded-colors checks.
- `helpers/`: shared mocks for route tests (`leagueRoutes.ts`).
- `integration/`: live-database suites, run only by `npm run test:integration`.
  `integration/helpers/` creates users and leagues, runs queries as a role (`asRole`),
  and cleans up.

## Where Things Go Next

- Static assets go in `public/`, created when the first one is needed.
- Specs live in `.kiro/specs/<feature>/`.
