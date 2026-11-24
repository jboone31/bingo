# F1: Auth and Profiles. Requirements

Depends on F0. Rules referenced: `product.md` (Identity), `tech.md`, `conventions.md`.

## Decisions Recorded

- **Default display name**: when a user has not chosen a name, the profile holds the
  name from their Google account, copied at first sign-in. If Google gives no name,
  the default is `Player` followed by the first four characters of the user id.
  The stored name is stable: later changes to the Google name do not alter it.
- A profile always has a display name. Blank names are rejected on edit; there is no
  "unset" state.

## User Stories And Acceptance Criteria

### R1. Sign in with Google

As a visitor, I sign in with my Google account so I can use the app.

1. The sign-in page shows a "Sign in with Google" action.
2. Completing Google consent returns the user to the app signed in, at the page they
   originally requested, or the home page if none.
3. A failed or cancelled sign-in returns to the sign-in page with a short message.
4. The `next` value used after sign-in is accepted only if it is a same-site relative
   path. Anything else (absolute URLs, `//host`, backslashes, control characters)
   falls back to the home page.
5. A signed-in user who opens the sign-in page is sent to the home page.

### R2. Profile creation

As a new user, I get a profile without any extra step.

1. First sign-in creates exactly one profile row for the user, in the same
   transaction that creates the auth user.
2. The display name is the Google full name, trimmed and cut to 40 characters. If it
   is missing or blank, the `Player xxxx` fallback is used.
3. Repeated sign-ins never create a second profile or change the stored name.

### R3. View and edit display name

As a signed-in user, I can see and change my display name.

1. A profile page shows the current display name and an edit form.
2. A name is trimmed, must be 1 to 40 characters, and must not contain control
   characters. Anything else is rejected with a machine-readable reason.
3. Saving updates the profile and the new name shows on the next page load.
4. Saving the same name twice is safe and returns success.
5. A user can edit only their own profile.

### R4. Session handling and protected routes

1. Every request refreshes the session cookie before the page or route runs.
2. Unauthenticated page requests are redirected to the sign-in page, carrying the
   original path as `next`.
3. Unauthenticated API requests receive `401` with JSON
   `{ "ok": false, "reason": "unauthenticated" }`. They are not redirected.
4. These paths are public: the sign-in page, `/api/auth/*`, and `/api/health`.
   Everything else requires a session.
5. Server code identifies the user from verified claims, never from an unverified
   cookie value.

### R5. Sign out

1. The signed-in layout offers a sign-out action.
2. Sign out clears the session and returns the user to the sign-in page.
3. Signing out when already signed out is safe.

### R6. Access and data protection

1. `profiles` has RLS enabled in the migration that creates it.
2. Authenticated users have a select policy only. Direct insert, update and delete
   from the browser fail.
3. In F1 a user can read only their own profile. F2 widens this to profiles of
   league co-members using the shared membership helper.
4. The profile write goes through a server route using postgres.js in a transaction.
5. No raw database error or connection detail reaches the client.

## Out Of Scope

- Other sign-in providers, email/password, or magic links.
- Avatars, account deletion, and profile fields beyond display name.
- Showing other users' profiles (arrives with F2).

## Manual Setup (not code)

- Enable the Google provider in the Supabase dashboard, with a Google OAuth client.
- Add redirect URLs for local, preview and production, ending in `/api/auth/callback`.
