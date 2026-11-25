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
`README.md`.

## Directory Details

### `app/`

Pages and server route handlers live together under the App Router. API routes are
under `app/api/`. Tests are co-located with the file they cover.

- `tokens.css`: design tokens (colors, type, spacing, motion). `globals.css`: base
  styles.
- `(app)/`: route group for signed-in pages. Its layout renders the app shell. URLs
  do not include `(app)`. `sign-in/` sits outside it and has its own layout.
- `(app)/dev/components/`: component gallery, 404 unless `ENABLE_DEV_TOOLS=1`.

### URL scheme

```
/                              home: my leagues
/profile
/leagues/new, /leagues/join    create, enter a code (F2 decides join paths)
/leagues/[leagueId]            overview
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
- `format/`: date and time formatting (viewer's time zone).

New domain areas (leagues, pool, draft, board) get their own folder here.

### `components/`

Shared React components.

- `ui/`: the design system (Button, TextField, Panel, Badge, PageHeader, Dialog,
  Toast, EmptyState, ErrorState, Spinner, Skeleton). Each has a CSS Module and a
  test. Styled only from tokens.
- `shell/`: the signed-in frame (AppHeader, UserMenu, PageContainer, SubNav).
- Top level: feature components such as `GoogleSignInButton`, `DisplayNameForm` and
  `LocalTime`.

### `utils/supabase/`

Factories for the Supabase client in each runtime: `client.ts` (browser),
`server.ts` (server components and routes), `middleware.ts` (used by `proxy.ts`).

### `supabase/migrations/`

Numbered SQL files (`NNNN_name.sql`), each wrapped in its own `begin; ... commit;`.
Applied in order by `npm run db:migrate`.

### `scripts/`

Node scripts run manually against the live Supabase project. They load `.env.local`.

- `apply-migrations.mjs`: apply un-applied migrations, tracked in a
  `schema_migrations` table. Supports `--dry-run` and `--baseline=N`.
- `check-db.mjs`: connectivity check that prints the host, never the password.

### `test/`

- `smoke/`: project-wide checks, including the structure consistency check.
- `integration/`: live-database suites, run only by `npm run test:integration`.

## Where Things Go Next

- Static assets go in `public/`, created when the first one is needed.
- Specs live in `.kiro/specs/<feature>/`.
