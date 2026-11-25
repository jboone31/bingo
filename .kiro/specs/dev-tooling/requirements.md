# F2.5: Dev Tooling and Seed Scenarios. Requirements

Depends on F2. Rules referenced: `conventions.md` (Dev Scenarios), `tech.md`
(Environments And Secrets), `roadmap.md`.

## Decisions Recorded

- **One Supabase project**, no separate dev database. The safeguards below are
  therefore mandatory.
- **Feasibility check (done):** a server using the service-role key can create a
  confirmed user, generate a magic-link token for it, and exchange that token for a
  real session. Result: pass. The Email provider does not need to be enabled.
- **UI first.** Scenarios and tools live on a `/dev` page backed by dev-only API
  routes. There is no CLI in F2.5. The roadmap's `npm run db:seed` line is replaced
  by this; a CLI can be added later if wanted.
- **The viewer is the signed-in user.** Scenarios put you in the league, as admin or
  as a regular member, alongside fake players. You stay signed in as yourself.
- **"Act as"** lets you become one of the fake players for testing their view. It
  replaces your session. To get back, sign in again with Google, or use a second
  browser profile for the fake player.
- **Fake players are a shared pool**: `seed-player-001@bingo-seed.test` up to `100`,
  created on first use and reused by every scenario. Their display names are
  `Seed Player 001` and so on.
- **Seed leagues are tagged** with a `seed_scenario` column, so reset removes only
  them.
- **Dev tools are off in production**, by two independent checks (below).

## User Stories And Acceptance Criteria

### R1. Safety gate

1. Every dev page and route first checks `isDevToolsEnabled()`. It is true only when
   `ENABLE_DEV_TOOLS=1` **and** `VERCEL_ENV` is not `production`. Otherwise pages
   return 404 and routes return `404 not_found`, with no other side effects.
2. The gate is one function used everywhere, covered by tests.
3. Dev routes also require a signed-in user (the standard `handle` order).
4. The service-role key is read only on the server, only inside dev-tool code, and
   never returned, logged, or sent to the browser.
5. `.env.example` and the `/dev` page state that the flag must never be set on Vercel
   Production.

### R2. Seed users

1. Seed users have emails `seed-player-NNN@bingo-seed.test` (`NNN` is 001 to 100),
   user metadata `{ "seed": true, "full_name": "Seed Player NNN" }`, and a confirmed
   email.
2. A scenario creates only the seed users it needs that do not exist yet, using the
   Supabase admin API, then reuses them.
3. Real users are never matched: a user counts as a seed user only if the email has
   the reserved domain, the exact `seed-player-NNN` pattern, and `seed: true` in
   metadata.

### R3. Scenarios

1. The `/dev` page offers these scenarios, each creating a new league tagged with its
   scenario name and named `[Seed] <description>`:

   | Scenario              | State                                                             |
   | --------------------- | ----------------------------------------------------------------- |
   | `league_empty`        | `pre_draft`, you are admin and the only member                    |
   | `league_with_players` | `pre_draft`, you are admin, 11 fake members, a draft date set     |
   | `league_full`         | `pre_draft`, you are admin, 99 fake members (100 total)           |
   | `member_view`         | `pre_draft`, a fake admin, you are a regular member, 12 players   |

2. Each scenario runs in one transaction and returns the new league's id, shown as a
   link.
3. Running a scenario twice creates two leagues. It is safe to repeat.
4. The set of scenarios is data in one place, so later features add theirs (pool,
   queue, draft states) without touching the page or routes.

### R4. Reset

1. **Reset my seed leagues** deletes seed-tagged leagues the signed-in user belongs
   to.
2. **Reset all seed data** deletes every seed-tagged league and every seed user.
3. Reset never touches a league without a `seed_scenario` tag, and never deletes a
   non-seed user.
4. Reset reports how many leagues and users were removed.

### R5. Act as

1. The `/dev` page lists existing seed users. Choosing one and confirming switches
   the browser to a real session for that user.
2. Only seed users can be targeted. The server re-checks the target against R2.3, so a
   crafted request cannot impersonate a real user.
3. After switching, a banner in the app header reads "Dev: acting as Seed Player 003"
   and links to `/dev`. The banner shows only when dev tools are enabled and the
   current user is a seed user.
4. All normal rules still apply: RLS, membership checks, and routes treat the fake
   user like any other.

### R6. Dev hub

1. `/dev` shows: scenarios, reset actions, the act-as switcher, and a link to the
   component gallery.
2. Results and errors appear as toasts. No raw errors are shown.
3. The page is mobile friendly and uses the shared components.

### R7. Convention updates

1. `conventions.md` names the home of scenarios (`lib/dev/scenarios.ts`) and the dev
   safety rules.
2. Later specs list the scenarios they need; F3 onward add them as a task.

### R8. Dev sign-in (added after F2.5 shipped)

Google sign-in from a phone on the local network failed because Supabase would not
accept the LAN address as a redirect URL. So that a real device can still be tested:

1. When dev tools are enabled and the page is loaded from a local or private-network
   address, the sign-in page also offers "Dev sign-in": a list of seed players and a
   button that signs in as the chosen one, with no Google redirect.
2. `POST /api/dev/sign-in` works without a session. It returns 404 unless dev tools
   are enabled (never on Vercel Production) **and** the request's Host is local or
   private (`localhost`, `*.local`, `127.*`, `10.*`, `192.168.*`, `172.16-31.*`).
3. It can only sign in as seed players. The target is re-checked in the database.
4. Never set `ENABLE_DEV_TOOLS` on Preview or Production: on a hosted preview the
   public hostname is refused, but the flag should not be on at all.

## Out Of Scope

- A command-line seeding tool.
- Returning to your real session after "act as" without signing in again.
- Seeding states that do not exist yet (pool, queue, draft). Those arrive with
  F3, F4, F6 and F7.
- Bots that pick during a draft (F7).

## Manual Setup

- `SUPABASE_SERVICE_ROLE_KEY` must be in `.env.local` (it already is) and set
  `ENABLE_DEV_TOOLS=1` locally.
