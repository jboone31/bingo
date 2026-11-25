# F2.5: Dev Tooling and Seed Scenarios. Design

## Overview

A dev-only layer: a gate function, a `leagues.seed_scenario` tag, a seed-user pool,
a scenario registry, three dev routes, and a `/dev` page. Everything is unavailable
unless `isDevToolsEnabled()` passes.

## Safety Gate

`lib/env/index.ts`:

```ts
export function isDevToolsEnabled(source: EnvSource = process.env): boolean {
  return source.ENABLE_DEV_TOOLS?.trim() === "1" && source.VERCEL_ENV !== "production";
}
```

- Layer 1: the flag. Layer 2: Vercel's own `VERCEL_ENV`, which Vercel sets and the
  project does not control. Setting the flag by mistake on Production still leaves
  the tools off.
- `lib/dev/gate.ts` (server-only): `assertDevTools()` throws
  `ApiError("not_found", 404)` when off. Dev routes call it in `parse`, before any
  other work. Dev pages call `notFound()` when the gate is off.
- Preview deployments share the production database. If the flag is set on Preview,
  the tools work there but can only touch seed data and seed users. Leave it off on
  Preview unless needed.

## Data Model

Migration `0005_seed_tag.sql`:

```sql
begin;
alter table public.leagues add column seed_scenario text;
create index leagues_seed_scenario_idx
  on public.leagues (seed_scenario) where seed_scenario is not null;
commit;
```

- `seed_scenario` is null for every real league. It is set only by dev tools. No
  policy change: the existing select policy covers it.
- Seed leagues cascade-delete their members through the existing foreign key.
  Later features' tables reference leagues with `on delete cascade`, so a reset
  removes them too.

## Seed Users (`lib/dev/seedUsers.ts`, server-only)

Pure helpers (also used on the client for display), in `lib/dev/seedIdentity.ts`:

- `SEED_DOMAIN = "bingo-seed.test"`, `SEED_POOL_SIZE = 100`.
- `seedEmail(n: number): string` gives `seed-player-007@bingo-seed.test` for 1 to 100.
- `seedName(n)` gives `Seed Player 007`.
- `parseSeedEmail(email: string): number | null` returns `n` only for an exact match
  of the pattern.
- `isSeedUser({ email, metadata })` is true only when `parseSeedEmail` matches **and**
  `metadata.seed === true`.

Server (admin API through `@supabase/supabase-js` with the service-role key, created
per call, `persistSession: false`):

- `ensureSeedUsers(count)`: finds existing seed users with one SQL query
  (`select id, email from auth.users where email like 'seed-player-%@bingo-seed.test'`),
  creates the missing ones in batches of 10 with `auth.admin.createUser`
  (`email_confirm: true`, metadata as above), and returns the ids for numbers 1 to
  `count`. The `handle_new_user` trigger creates their profiles.
- `listSeedUsers()`: id, display name, number, using SQL on `auth.users` joined to
  `profiles`.
- `deleteAllSeedUsers()`: deletes each through `auth.admin.deleteUser`.

## Scenarios (`lib/dev/scenarios.ts`)

A registry, so later features append entries:

```ts
export interface ScenarioPlan {
  readonly leagueName: string;
  readonly viewerRole: "admin" | "member";
  readonly fakeMembers: number;      // seed players added besides the viewer
  readonly fakeAdmin: boolean;       // a seed player is the admin
  readonly draftAtOffsetDays: number | null;
}

export const SCENARIOS: Record<string, { label: string; description: string; plan: ScenarioPlan }>;
export function planFor(name: string): ScenarioPlan | null;
```

`planFor` is pure and tested. Plans:

| Scenario              | viewerRole | fakeMembers | fakeAdmin | draft date |
| --------------------- | ---------- | ----------- | --------- | ---------- |
| `league_empty`        | admin      | 0           | no        | none       |
| `league_with_players` | admin      | 11          | no        | +7 days    |
| `league_full`         | admin      | 99          | no        | +7 days    |
| `member_view`         | member     | 11          | yes       | +7 days    |

For `member_view`, `fakeMembers` counts the admin: one fake admin plus 10 fake
members, plus the viewer, 12 players.

`lib/dev/seedScenario.ts` (server-only) runs a plan:
1. `ensureSeedUsers(plan.fakeMembers)`.
2. One `withTransaction`: insert the league (`created_by` is the admin: the viewer, or
   fake player 1), with `seed_scenario = name`; insert the admin membership first,
   then the other members. The existing guard trigger applies as usual (status is
   `pre_draft`, count under 100). Draft date is `now() + offset`.
3. Returns the league id.

Because inserts use the same tables and triggers as the real routes, a scenario
cannot produce a state the app could not reach.

## Reset (`lib/dev/reset.ts`, server-only)

- `resetMine(tx, userId)`:
  `delete from leagues where seed_scenario is not null and id in (select league_id from league_members where user_id = $1) returning id`.
- `resetAll(tx)`: `delete from leagues where seed_scenario is not null returning id`,
  then `deleteAllSeedUsers()` outside the transaction (admin API).
- Both return counts. Neither has a path that deletes an untagged league or a user
  that fails `isSeedUser`: the user deletion reads the list from `listSeedUsers()`,
  which only returns users matching the reserved pattern.

## Act As (`lib/dev/actAs.ts`, server-only)

1. Re-load the target from `auth.users` by id; require `isSeedUser`. Else
   `ApiError("not_found", 404)`.
2. `admin.auth.admin.generateLink({ type: "magiclink", email })` returns
   `properties.hashed_token`.
3. Using the cookie-bound server client (`utils/supabase/server`):
   `verifyOtp({ token_hash, type: "magiclink" })`. This sets the session cookies for
   the target user, replacing the current session.
4. Return `{ ok: true }`; the page then navigates to `/`.

The token is used once, immediately, and never leaves the server.

## Routes

Under `app/api/dev/`, Node.js runtime, built on `handle`. Each starts with
`assertDevTools()` in `parse`.

| Method and path          | Body                  | Result                                    |
| ------------------------ | --------------------- | ----------------------------------------- |
| `POST /api/dev/seed`     | `{ scenario }`        | `{ ok, leagueId }`                        |
| `POST /api/dev/reset`    | `{ scope: "mine" \| "all" }` | `{ ok, leagues, users }`           |
| `POST /api/dev/act-as`   | `{ userId }`          | `{ ok }`                                  |

Unknown scenario: `400 invalid_scenario`. Bad scope: `400 invalid_body`. Unknown or
non-seed target: `404 not_found`. Failures use the standard shape; nothing from the
admin API is returned.

## Pages And Components

- `app/(app)/dev/page.tsx`: the hub. Server component that calls the gate, loads
  `listSeedUsers()`, and renders `DevTools`.
- `components/dev/DevTools.tsx` (client): three Panels.
  - **Scenarios**: a list from `SCENARIOS` (label, description, Run button). The
    result shows as a toast with a link to the league.
  - **Reset**: "Reset my seed leagues" and "Reset all seed data" (the second behind a
    `ConfirmAction`-style dialog).
  - **Act as**: a `Select` of seed users and a Switch button (with confirm).
  - A link to `/dev/components`.
- `components/dev/DevBanner.tsx`: the "acting as" bar. `AppHeader` receives an optional
  `devActingAs: string | null`; `(app)/layout.tsx` sets it only when the gate is on and
  the current user's email passes `parseSeedEmail`.
- Dev pages sit under `(app)`, so they use the shell.

The `/dev/components` gallery switches to the shared `assertDevTools`-based gate
(`notFound()` when off) so there is one gate.

## Conventions Updates

`conventions.md`, Dev Scenarios section:

- Scenarios live in `lib/dev/scenarios.ts` as plan data and are run by `seedScenario`.
  Replace the earlier mention of `scripts/seed/`.
- Every dev entry point goes through `isDevToolsEnabled()`; it is false on Vercel
  Production regardless of the flag.
- Dev code only touches rows tagged `seed_scenario` and users that pass `isSeedUser`.

## Testing

Offline:

- `isDevToolsEnabled`: examples for flag on/off crossed with `VERCEL_ENV` of
  `production`, `preview`, `development`, and unset. Property: never true when
  `VERCEL_ENV === "production"`.
- `seedIdentity`: property that `parseSeedEmail(seedEmail(n)) === n` for 1 to 100;
  `isSeedUser` is false for any other domain, pattern, or missing flag (examples:
  `seed-player-001@gmail.com`, `seed-player-101@bingo-seed.test`,
  `seed-player-1@bingo-seed.test`, `real@bingo-seed.test`).
- `planFor`: property over every scenario that total members (viewer plus fakes, not
  counting the admin twice) is between 1 and 100, exactly one admin exists, and the
  unknown name returns `null`.
- Routes with the gate, session, and helpers mocked: 404 when the gate is off (and no
  other call happens), 401 signed out, 400 bad input, success, and no raw error text.
- `DevTools` component: Run calls the seed route, shows a link toast; "Reset all"
  needs confirmation; act-as is disabled until a user is chosen.
- `DevBanner` and `AppHeader` render the banner only when `devActingAs` is set.

Integration (`test/integration/devTools.integration.test.ts`; uses the service-role
key, so it creates and removes only seed data):

- Each scenario creates the expected member count, roles, status, and tag.
- Running the same scenario twice creates two leagues.
- `resetMine` removes the viewer's seed leagues and leaves an untagged league alone.
- `resetAll` removes tagged leagues and seed users, and leaves non-seed users.
- `actAs` refuses a non-seed user.

## Structure Updates

- `structure.md`: `lib/dev/`, `components/dev/`, `app/api/dev/`, `/dev`.
- `.env.example`: the Vercel warning, and `VERCEL_ENV` note.
- `roadmap.md`: replace the `db:seed` line with the UI tools; mark F2.5 Done.
