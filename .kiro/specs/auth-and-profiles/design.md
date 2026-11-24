# F1: Auth and Profiles. Design

## Overview

Supabase Auth handles Google OAuth with the PKCE flow. The browser starts sign-in,
Google returns to a server callback route that exchanges the code for a session
cookie, and `proxy.ts` refreshes that cookie and gates routes. A `profiles` table,
filled by a database trigger, holds the display name.

## Flow

1. `/sign-in` (client button) calls `supabase.auth.signInWithOAuth({ provider:
'google', options: { redirectTo: <origin>/api/auth/callback?next=<safe next> } })`.
2. Google redirects to `GET /api/auth/callback?code=...&next=...`.
3. The route calls `exchangeCodeForSession(code)`, then redirects to
   `safeNext(next)`. On error it redirects to `/sign-in?error=auth_failed`.
4. On the first insert into `auth.users`, a trigger inserts the profile.
5. `proxy.ts` calls `supabase.auth.getClaims()` on each request (refreshing
   cookies), then applies `decideAccess`.

## Modules

### `lib/auth/redirect.ts` (pure)

`safeNext(raw: string | null | undefined): string`. Returns `raw` only when it starts
with a single `/`, not `//`, contains no `\`, no control characters, and parses
against a dummy origin to the same origin. Otherwise returns `/`.

### `lib/auth/access.ts` (pure)

`decideAccess(pathname: string, isAuthenticated: boolean)` returns one of
`{ kind: "allow" }`, `{ kind: "redirect", to: string }`,
`{ kind: "unauthorized" }`.

- Public: `/sign-in`, `/api/health`, and anything under `/api/auth/`.
- Public path + authenticated + `/sign-in`: redirect to `/`.
- Non-public, unauthenticated: `/api/*` gives `unauthorized`; pages give a redirect
  to `/sign-in?next=<encoded pathname+search>`.
- Later features that add public machine routes (cron) extend the public list in
  this one file.

### `lib/profile/displayName.ts` (pure)

`parseDisplayName(input: unknown)` returns `{ ok: true, value }` or
`{ ok: false, reason: "invalid_display_name" }`. Trims, requires a string of 1 to 40
characters (counted by code points), rejects control characters.

### `lib/profile/updateProfile.ts` (server-only)

Takes a transaction handle and `userId`, runs
`update profiles set display_name = $1, updated_at = now() where id = $2 returning ...`
and returns the row. Idempotent by construction.

### `utils/supabase/middleware.ts` (existing, extended)

Calls `getClaims()` after creating the server client, passes `isAuthenticated` to
`decideAccess`, and returns the redirect, a `401` JSON response, or the cookie-
carrying response. Redirect and 401 responses copy the refreshed cookies from
`supabaseResponse`.

### `lib/auth/session.ts` (server-only)

`getSessionUser()` builds the server client and returns `{ id, email } | null` from
`getClaims()`. Used by routes and server components.

## Routes And Pages

| Path                     | Kind        | Behavior                                              |
| ------------------------ | ----------- | ----------------------------------------------------- |
| `/sign-in`               | page        | Google button, error message from `?error=`           |
| `/api/auth/callback`     | GET route   | Code exchange, redirect to safe `next`                |
| `/api/auth/sign-out`     | POST route  | `auth.signOut()`, redirect `303` to `/sign-in`        |
| `/api/profile`           | PATCH route | Update own display name                               |
| `/profile`               | page        | Shows name, edit form (client component)              |
| `/` (existing)           | page        | Shows the signed-in name, links to profile, sign out  |

`PATCH /api/profile` order of work: parse JSON body (reject non-object or unknown
keys), `parseDisplayName`, `getSessionUser` (401 if none), one transaction calling
`updateProfile`, return `{ ok: true, profile: { displayName } }`. Failures return
`{ ok: false, reason }` with `400`, `401` or `500` (`internal_error`, nothing else
leaked). Node.js runtime.

Sign-out is POST only so a link prefetch or cross-site GET cannot sign a user out.
The sign-out form is a plain `<form method="post">`.

Shared UI goes in a new `components/` directory (sign-out button, display name
form). Add it to the layout block in `structure.md`.

## Data Model

Migration `0002_profiles.sql`:

```sql
begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (display_name = btrim(display_name)
           and char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(left(btrim(new.raw_user_meta_data ->> 'full_name'), 40), ''),
      nullif(left(btrim(new.raw_user_meta_data ->> 'name'), 40), ''),
      'Player ' || left(new.id::text, 4)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

commit;
```

Notes:

- `profiles.id` is the auth user id rather than a generated uuid. This is a
  deliberate exception to the "database default" key rule: the row is one-to-one
  with `auth.users`.
- The primary key index covers the policy filter (`id`).
- `btrim` removes spaces only; the control-character rule is enforced in
  `parseDisplayName`. The SQL check is a backstop for length and trimming.
- `profiles` is not added to the Realtime publication: no client subscribes to it.
- Existing users (created before the migration) are backfilled by an
  `insert ... select ... from auth.users on conflict do nothing` in the same file.
- The trigger function is executable only by the table owner/trigger machinery, per
  the "mutating functions revoked" rule.

## Error Handling

- Callback failure: redirect to `/sign-in?error=auth_failed`. The page maps known
  codes to fixed text and ignores unknown values.
- Profile route: fixed reasons `invalid_body`, `invalid_display_name`,
  `unauthenticated`, `profile_not_found` (no row updated, `404`), `internal_error`.
- Failure to reach Supabase in `proxy.ts` is treated as unauthenticated for pages
  (redirect to sign-in) and `401` for API routes.

## Testing

Offline (Vitest, fast-check with at least 100 runs):

- `safeNext`: property that the result is always `/` or a string starting with a
  single `/` and parsing to the dummy origin; examples for `//evil.com`,
  `/\evil.com`, `https://x`, `/ok?a=1`, empty, null.
- `decideAccess`: property that unauthenticated + non-public never gives `allow`;
  public paths allow when unauthenticated; API paths never redirect.
- `parseDisplayName`: property that any `ok` value is trimmed, 1 to 40 code points,
  without control characters; examples for blank, 41 chars, emoji, non-string.
- Route tests for `PATCH /api/profile` with the session and database mocked: 401,
  400 bodies, success, no raw error text on failure.
- `sign-in` page smoke test; update structure consistency test expectations for
  `components/`.

Integration (`test/integration/profiles.test.ts`, service role creates users):

- Creating an auth user creates one profile with the Google name from metadata.
- Missing name gives `Player xxxx`; overlong name is cut to 40.
- Owner can read own profile; another user cannot; anon cannot.
- Direct insert, update and delete by an authenticated user fail.
- Deleting the auth user deletes the profile.
- Re-running the migration backfill does not duplicate rows.
