# F2: Leagues. Design

## Overview

Two tables (`leagues`, `league_members`), shared RLS helper functions, and server
routes that do every write in one locked transaction. Rules live in `lib/leagues/` as
pure functions. Pages read through RLS using the signed-in user's session.

## Data Model

Migration `0004_leagues.sql`:

```sql
begin;

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (name = btrim(name) and char_length(name) between 1 and 60),
  status text not null default 'pre_draft'
    check (status in ('pre_draft', 'drafting', 'in_progress')),
  draft_at timestamptz,
  join_code text not null unique
    check (join_code ~ '^[2-9A-HJKMNP-Z]{8}$'),
  created_by uuid not null references auth.users (id) on delete restrict,
  create_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (created_by, create_key)
);

create table public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create unique index league_members_one_admin
  on public.league_members (league_id) where role = 'admin';
create index league_members_user_id_idx on public.league_members (user_id);
```

Notes:

- `league_members.user_id` references `profiles(id)` (not `auth.users`), so PostgREST
  can embed `profiles(display_name)` in a member read and a member always has a
  profile.
- `created_by` uses `on delete restrict`: deleting an auth user who created a league
  is blocked until the league is dealt with. The admin role lives on
  `league_members`, so transferring admin does not change `created_by`.
- `unique (created_by, create_key)` is the idempotency key for creation. Nulls do not
  conflict, so `create_key` is optional at the database level.
- `join_code` is stored in the normalized form (no hyphen). The unique constraint
  creates the lookup index.
- Tables that later features attach to a league must reference it with
  `on delete cascade`, so deleting a league removes everything it owns. This goes into
  `conventions.md`.

Triggers (functions `security definer`, `search_path = ''`, execute revoked from
`public`, `anon`, `authenticated`):

- `leagues_status_forward` (before update of `status`): rank `pre_draft` 0,
  `drafting` 1, `in_progress` 2; raise if the new rank is lower than the old one.
- `leagues_touch` (before update): sets `updated_at = now()`.
- `league_members_guard` (before insert): `select ... from leagues where id = new.league_id for update`;
  raise `league_not_pre_draft` unless status is `pre_draft`; raise `league_full` if
  the member count is already 100.

Helper functions (`security definer`, `search_path = ''`, `stable`, execute granted to
`authenticated` only, because policies run as the caller):

```sql
create function public.is_league_member(p_league_id uuid) returns boolean ...
  -- exists (select 1 from league_members where league_id = p_league_id
  --                                         and user_id = (select auth.uid()))
create function public.shares_league_with(p_user_id uuid) returns boolean ...
  -- exists (select 1 from league_members a join league_members b
  --          on a.league_id = b.league_id
  --          where a.user_id = (select auth.uid()) and b.user_id = p_user_id)
```

`is_league_admin` is added with the first feature that needs it in a policy; F2 checks
admin in server routes.

Policies and grants:

```sql
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

create policy leagues_select_member on public.leagues
  for select to authenticated using (public.is_league_member(id));
create policy league_members_select_member on public.league_members
  for select to authenticated using (public.is_league_member(league_id));

drop policy profiles_select_own on public.profiles;
create policy profiles_select_self_or_comember on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_league_with(id));

revoke all on public.leagues, public.league_members from anon, authenticated;
grant select on public.leagues, public.league_members to authenticated;
```

Indexes cover every policy filter: `league_members (league_id, user_id)` through the
unique constraint, and `league_members (user_id)`.

The `join_code` column is readable by every member (they share it). It is not
sensitive after the draft starts, and the join route refuses non-`pre_draft` leagues.

No Realtime publication in F2: nothing subscribes yet. F5 adds it.

## Pure Logic (`lib/leagues/`)

- `joinCode.ts`: `JOIN_CODE_ALPHABET`, `generateJoinCode(randomInt?)` (uses
  `crypto.randomInt`, injectable for tests), `normalizeJoinCode(raw): string | null`
  (uppercases, strips spaces and hyphens, returns `null` unless 8 characters from the
  alphabet), `formatJoinCode(code)` (`K7P2-QX9M`).
- `name.ts`: `parseLeagueName(input: unknown)`, 1 to 60 code points, trimmed, no
  control characters, reason `invalid_name`.
- `draftAt.ts`: `parseDraftAt(input: unknown)`: `undefined` or `null` gives
  `{ ok: true, value: null }`; a string that parses as a date gives its UTC ISO
  string; anything else gives `invalid_draft_at`.
- `rules.ts`: decisions as `{ ok: true } | { ok: false, reason, status }`, taking plain
  data (status, member count, roles), no database:
  - `canJoin({ status, memberCount, alreadyMember })`
  - `canLeave({ status, role })`
  - `canRemove({ status, actorRole, targetRole, isSelf })`
  - `canRegenerateCode({ status, actorRole })`
  - `canTransfer({ actorRole, targetIsMember, targetIsAdmin })`
  - `canDelete({ status, actorRole, confirmName, leagueName })`

  `reason` values and HTTP statuses are in the table below.
- `types.ts`: `LeagueStatus`, `MemberRole`.

## Server Data Access (`lib/leagues/queries.ts`, server-only)

Functions take the `QueryRunner` and run parameterized SQL.

- `lockLeagueById(tx, id)` and `lockLeagueByCode(tx, code)`:
  `select ... from leagues ... for update`.
- `getMember(tx, leagueId, userId)`, `countMembers(tx, leagueId)`.
- `insertLeague(tx, { name, draftAt, createdBy, createKey })`: generates a code and
  runs `insert ... on conflict do nothing returning`. Retries up to 5 times when the
  code collides. An `on conflict (created_by, create_key) do nothing` path returns the
  existing league for a repeated request.
- `insertMember`, `deleteMember`, `setRole`, `setJoinCode` (same retry), `deleteLeague`.

Transfer runs the demotion update before the promotion update so the one-admin unique
index is never violated, inside one transaction.

## Routes

All under `app/api/leagues/`, Node.js runtime, built on `lib/api/`. All return
`{ ok: true, ... }` or `{ ok: false, reason }`.

| Method and path                                   | Body                              | Result                          |
| ------------------------------------------------- | --------------------------------- | ------------------------------- |
| `POST /api/leagues`                               | `{ name, draftAt?, requestId }`   | `{ ok, league: { id } }`        |
| `POST /api/leagues/join`                          | `{ code }`                        | `{ ok, leagueId, alreadyMember }` |
| `POST /api/leagues/[leagueId]/leave`              | none                              | `{ ok }`                        |
| `DELETE /api/leagues/[leagueId]/members/[userId]` | none                              | `{ ok }`                        |
| `POST /api/leagues/[leagueId]/join-code`          | none                              | `{ ok, joinCode }`              |
| `POST /api/leagues/[leagueId]/transfer`           | `{ userId }`                      | `{ ok }`                        |
| `DELETE /api/leagues/[leagueId]`                  | `{ confirmName }`                 | `{ ok }`                        |

Order of work in each: validate input (ids are checked as UUIDs, unknown keys
rejected), authenticate, open one transaction, lock the league row, load the caller's
membership, apply the pure rule, write, return.

Reasons and statuses:

| Reason                  | Status | When                                                         |
| ----------------------- | ------ | ------------------------------------------------------------ |
| `invalid_body`          | 400    | not a JSON object, unknown keys, bad ids                     |
| `invalid_name`          | 400    | league name fails validation                                 |
| `invalid_draft_at`      | 400    | draft date is not a valid timestamp                          |
| `invalid_code`          | 400    | code cannot be valid                                         |
| `confirmation_mismatch` | 400    | delete confirmation differs from the league name             |
| `unauthenticated`       | 401    | no session                                                   |
| `not_admin`             | 403    | member without the admin role on an admin action             |
| `league_not_found`      | 404    | no such league, or the caller is not a member                |
| `league_not_pre_draft`  | 409    | action needs `pre_draft`                                     |
| `league_full`           | 409    | 100 members                                                  |
| `admin_cannot_leave`    | 409    | admin tried to leave                                         |
| `cannot_remove_self`    | 409    | admin tried to remove themselves                             |
| `target_not_member`     | 409    | transfer target is not a member                              |
| `internal_error`        | 500    | anything unexpected                                          |

Repeat safety:

- Create: same `requestId` returns the same league.
- Join: already a member gives `alreadyMember: true`.
- Leave and remove: not a member gives success (leave also for a league that does not
  exist, so existence is not leaked).
- Regenerate: each call makes a new code; repeating is harmless.
- Transfer: target already admin gives success.
- Delete: a second call finds no league and returns `league_not_found`. It has no
  further effect.

## `lib/api/` (server-only)

- `response.ts`: `ok(data?, status = 200)`, `fail(reason, status)`.
- `errors.ts`: `class ApiError extends Error { reason, status }`.
- `body.ts`: `readJsonObject(request, allowedKeys)` returns the parsed object or
  throws `ApiError("invalid_body", 400)` for bad JSON, arrays, or unknown keys.
- `ids.ts`: `parseUuid(value)` returns the id or throws `invalid_body`.
- `handler.ts`: `handle({ parse, run })` returns a Next route handler.
  `parse(request, params)` returns validated input or throws `ApiError`.
  `run({ user, input })` returns a `NextResponse` and may throw `ApiError`. The wrapper
  calls `parse`, then `getSessionUser` (401 if none), then `run`, and maps an
  `ApiError` to `fail` and anything else to `500 internal_error`.

`PATCH /api/profile` moves onto `handle` in task 1, with its tests unchanged.

## Pages

```
app/(app)/page.tsx                         home list (replaces the empty state)
app/(app)/leagues/new/page.tsx             create form
app/(app)/leagues/join/page.tsx            enter a code
app/(app)/join/[code]/page.tsx             invite link: confirm and join
app/(app)/leagues/[leagueId]/layout.tsx    loads the league through RLS, 404 if not a member, mounts SubNav
app/(app)/leagues/[leagueId]/page.tsx      overview
app/(app)/leagues/[leagueId]/settings/page.tsx   admin only
```

The league layout reads `leagues` for the id through the RLS client. No row means
`notFound()`. The settings page also checks the caller's role and calls `notFound()`
for non-admins.

Reads (`lib/leagues/read.ts`, server-only, RLS client):

- `listMyLeagues()`: `leagues` with `league_members(count)`, ordered by `created_at`
  descending, merged with the user's own role from `league_members`.
- `getLeague(id)` and `listMembers(id)` (members with `profiles(display_name)`,
  admin first, then by join time).

### Components (`components/leagues/`)

| Component              | Notes                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| `LeagueCard`           | Home list entry. Name, status badge, member count, `LocalTime` or "Date to be set", Admin badge. |
| `CreateLeagueForm`     | Name and optional `datetime-local`. Generates `requestId` with `crypto.randomUUID()` once per mount. |
| `JoinLeagueForm`       | Code field; accepts pasted codes with or without hyphen. Also used by `/join/[code]` with the code prefilled. |
| `InvitePanel`          | Code and link with Copy buttons that toast on success. Shown only while `pre_draft`. |
| `MemberList`           | Server component. Names, admin marker; the admin sees a Remove action on other rows. |
| `ConfirmAction`        | Shared client component: a button that opens a `Dialog` and runs a fetch on confirm, with loading and error toast. Used for leave, remove, regenerate, and transfer. |
| `DeleteLeagueDialog`   | Dialog with a `TextField` that must match the league name before Delete enables. |
| `TransferAdminForm`    | Member select and a confirm step.                                        |

After a successful action a client component calls `router.refresh()` or navigates
(`router.push("/")` after leave and delete).

Wireframes: see `.kiro/specs/design-system/design.md` (Home, League overview). Settings
is a stack of Panels: Invite code (with Regenerate), Transfer admin, Danger zone
(Delete).

## Testing

Offline:

- `joinCode`: property that every generated code is accepted by `normalizeJoinCode`,
  is 8 characters from the alphabet, and that `normalize(format(code)) === code`;
  `normalizeJoinCode` accepts any case and separators, and rejects other lengths and
  characters (examples for `0`, `O`, `1`, `I`, `L`).
- `parseLeagueName` and `parseDraftAt`: examples and properties like F1's display name.
- `rules`: example tables per function, plus properties: nothing is allowed unless the
  status is `pre_draft` (except transfer), a non-admin can never remove, regenerate,
  delete or transfer, and the admin can never leave.
- `lib/api`: `readJsonObject`, `parseUuid`, and `handle` (401, `ApiError` mapping, 500
  without detail).
- Route tests with the session and database mocked, per route: bad input, 401,
  not-found for non-members, role checks, success, repeat calls, and no raw error text.
- Component tests: `LeagueCard`, `CreateLeagueForm`, `JoinLeagueForm`, `InvitePanel`,
  `DeleteLeagueDialog` (button disabled until the name matches), `ConfirmAction`.
- Page smoke tests for home and for `/join/[code]`.

Integration (`test/integration/leagues.integration.test.ts`, with shared helpers in
`test/integration/helpers/` that replace the inline helpers in the profiles test; F2.5
extends them):

- Member reads their league and member rows; non-member reads neither; anon reads
  nothing.
- Co-member reads each other's profiles; a stranger's profile is hidden.
- No direct insert, update or delete succeeds for an authenticated user on either
  table.
- One admin per league (second admin insert fails); the admin demote-then-promote
  order succeeds in one transaction.
- Status cannot move backward; joining a `drafting` league is rejected by the trigger;
  the 101st member is rejected.
- Join code constraint rejects bad characters and lengths; duplicate codes are
  rejected.
- Deleting a league removes its members; deleting a member's profile removes their
  membership.
- Idempotent create: the same `(created_by, create_key)` cannot insert twice.

## Structure And Convention Updates

- `structure.md`: `lib/leagues/`, `lib/api/`, `components/leagues/`, the new routes and
  pages.
- `conventions.md` (Database): tables owned by a league reference it with
  `on delete cascade`.
- `draft-rules.md`: no change; the decisions above are recorded there already, plus
  removal during `pre_draft` is added under Leagues And Membership.
