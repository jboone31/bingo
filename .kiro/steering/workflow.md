# Workflow

How work gets done on this project, and what to know before touching anything. Read
`roadmap.md` first: its "Status And Handoff" section says what is built and what is next.

## The Loop For A Feature

1. Read the feature's section in `roadmap.md` and the features it depends on.
2. Settle its **Open** questions with the user before writing anything. Offer options
   with trade-offs and a recommendation. The user often answers "go with your
   recommendations", so make the recommendation concrete and list your assumptions.
3. Write the spec in `.kiro/specs/<feature>/`: `requirements.md` (decisions recorded,
   user stories with numbered acceptance criteria, out of scope), `design.md` (data
   model, pure logic, routes, components, testing plan) and `tasks.md` (numbered
   checkboxes that cite requirement ids). Commit it. Then ask before implementing.
4. Implement in task order, ticking boxes as you go. Record decisions that change
   steering in `draft-rules.md`, `product.md`, `conventions.md` or `roadmap.md`.
5. Meet "Done Means" in `conventions.md`. Update `structure.md`, `roadmap.md`, and the
   feature's dev scenarios.
6. Commit once per feature with a short imperative message (for example "Add pool
   administration: add, CSV import, edit, delete, clear (F3)"). Small follow-up fixes
   get their own short commits. **Never push**: the user pushes.
7. Report plainly: what was built, what was **not** run or verified, and a numbered
   manual-check list. Leave manual-check tasks unticked until the user confirms them.

You cannot open a browser. UI work is verified by unit, component and integration tests;
say so, and give the user the manual steps. Do not claim a UI works because tests pass.

## Commands

Node 26 (`nvm use`), macOS, zsh. There is no GNU `timeout`.

| Command | Notes |
| --- | --- |
| `npm run typecheck`, `lint`, `format:check`, `test`, `build` | All must pass. `npm test` is offline and takes seconds. |
| `npm run db:migrate -- --dry-run`, then `npm run db:migrate` | Applies `supabase/migrations/*.sql` to the **live** project. Never edit an applied migration. |
| `npm run test:integration -- <name> ...` | Positional filters pick files, e.g. `leagues profiles pool queue leagueQueries queueReads db.integration`. Every query is a network round trip (about a second), so a suite takes 30 to 100 seconds. Set the tool timeout high, and give slow `describe` blocks `{ timeout: 60_000 }`. |
| `rm -rf .next` | Do this before `typecheck` after moving or deleting routes. Stale `.next/types` cause false errors. |

Prettier ignores `.kiro/` and `README.md`, so keep lines to about 88 characters by hand.

## Secrets And Access

- Do not read, print or use values from `.env.local`, and do not run scripts that use
  `SUPABASE_SERVICE_ROLE_KEY`, unless the user grants it explicitly for that one task
  (they have done so once, by naming the variable). A blocked attempt is not something
  to work around: ask.
- `test/integration/devTools.integration.test.ts` exercises code that uses the
  service-role key (seed users, act-as). It has **not** been run by an agent. Ask the
  user to run `npm run test:integration -- devTools`, or for permission.
- Migrations and the other integration suites use `SUPABASE_DB_URL`, which is the normal
  working path.
- **One Supabase project serves dev and production.** Everything an agent or test
  creates is real data. Integration tests create their own users and leagues through
  `test/integration/helpers` and delete them. Dev tooling touches only tagged seed data.

## Lessons Already Paid For

These each caused a bug. The rules are in `conventions.md`; this is the short list.

- **Phone over `http://<LAN IP>:3000` is not a secure context.** `crypto.randomUUID()`
  and WebCrypto do not exist there. Use `newRequestId()` (`lib/ids`).
- **`Intl` formatting differs between Node and browsers**, which breaks hydration for
  server-rendered dates. Use `LocalTime` or `formatUtcStable`.
- **Libraries that number DOM ids from a module counter** (dnd-kit) mismatch between
  server and client. Pass a stable `id` from `useId()`.
- **Touch drag**: use `TouchSensor` with a press-and-hold, never `PointerSensor` (it
  reacts to every finger) and never `touch-action: none` on a handle (it blocks
  scrolling). A test guards this.
- **New tables need an explicit `grant select ... to authenticated`.** This project does
  not grant by default, so a policy alone gives "permission denied".
- **PostgREST**: escape `ilike` patterns with `searchPattern` and `exactPattern`; embed
  relationships by constraint name (`submissions!queue_items_submission_fkey`).
- **The server connects as the database owner**, which bypasses RLS. Server code (and
  tests) can read any player's queue. The browser cannot.
- **Hot reload can serve a stale route** in `next dev`. Unexpected route errors print
  `[api] unexpected error: ...` in the dev terminal; ask the user for that line.

## About The User

Hobby project, one developer. Tests by hand on a laptop and on a phone (a LAN address
that changes with the router; the dev server prints it as "Network"). Google sign-in
from the phone does not work (Supabase rejects the LAN redirect URL, cause unknown), so
the phone uses the "Dev sign-in" panel on the sign-in page. Prefers short, direct
answers, decisions written into steering, and honesty about what was not verified.
