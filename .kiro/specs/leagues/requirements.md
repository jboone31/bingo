# F2: Leagues. Requirements

Depends on F1.5. Rules referenced: `draft-rules.md` (Leagues And Membership),
`conventions.md` (Access Model, RLS Policies, Server Routes), `product.md`.

## Decisions Recorded

- The admin is also a player and counts in `N`.
- League status is one field: `pre_draft`, `drafting`, `in_progress`. It only moves
  forward, and the database refuses a backward move.
- **Join code**: 8 characters from `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (no `0 O 1 I L`),
  shown as `K7P2-QX9M`, case-insensitive, hyphen and spaces ignored. The invite link
  is `/join/K7P2QX9M`. One code serves both. It works until the draft starts. The
  admin can regenerate it, which invalidates the old one. There is no attempt limit
  for now.
- **Create form**: league name (1 to 60 characters) and an optional draft date. F3
  adds editing of the date.
- **Deletion**: only the admin, only while `pre_draft`, confirmed by typing the league
  name. The delete cascades to everything the league owns. **Changed after F6**: any
  status (see `draft-rules.md`), with an extra warning once the draft has started.
- **Removal**: the admin can remove another member while `pre_draft`.
- **Leaving**: a member can leave while `pre_draft`. The admin cannot leave. They must
  transfer admin or delete the league.
- **Admin transfer**: included. The admin hands over to another current member, in
  any league status.
- **Member cap**: 100 per league, enforced in the database.
- **Home list**: every league the user belongs to, newest first. No archive.
- Co-members can read each other's display names.
- Not in F2: attempt limiting for join codes, archiving, invitations by email.

## User Stories And Acceptance Criteria

### R1. Create a league

1. A signed-in user can create a league from `/leagues/new` with a name and an
   optional draft date.
2. The name is trimmed, 1 to 60 characters, with no control characters. Anything else
   is rejected with `invalid_name`.
3. The draft date, if given, must be a valid timestamp. It is stored as `timestamptz`
   and may be in the past. Invalid values are rejected with `invalid_draft_at`.
4. The league starts as `pre_draft` with a generated join code. The creator becomes
   its admin and its first member, in the same transaction.
5. The form sends a client-generated request id. Repeating the same request returns
   the league already created instead of making a second one.
6. After creating, the user lands on the league overview.

### R2. Join a league

1. A user can join by entering a code at `/leagues/join` or opening `/join/<code>`.
2. The invite link page shows the code and a Join button. Opening the link does not
   join by itself, so link previews and prefetching cannot add anyone.
3. The code is normalized (case, hyphen, spaces) before lookup. A code that cannot be
   valid is rejected with `invalid_code`. A valid-looking code that matches no league
   returns `league_not_found`.
4. Joining adds the user as a regular member.
5. Joining a league the user is already in succeeds without change.
6. Joining is refused with `league_not_pre_draft` once the draft has started, and
   with `league_full` at 100 members. The database enforces both as well.
7. A signed-out user who opens an invite link is sent through sign-in and returned to
   the link.

### R3. Home list

1. The home page lists the user's leagues, newest first. Each entry shows the name, a
   status badge, the member count, the draft date in the viewer's time zone (or "Date
   to be set"), and an Admin badge when they run it.
2. An entry links to the league overview.
3. With no leagues, the page shows an empty state with Create and Join actions. With
   leagues, the same two actions sit in the page header.

### R4. League overview

1. Only members can open `/leagues/[leagueId]`. Anyone else gets the not-found page,
   whether or not the league exists.
2. The overview shows the name, status badge, draft date, and a player list with
   display names. The admin is marked.
3. The invite panel shows the code and the link with Copy buttons, while the league is
   `pre_draft`. After that it is hidden.
4. A non-admin member sees a Leave action while `pre_draft`.
5. League pages show second-level navigation (`SubNav`) with Overview, plus Settings
   for the admin. Later features add their own items.

### R5. Leave and remove

1. A non-admin member can leave while `pre_draft`, after confirming. Leaving when
   already not a member succeeds without change.
2. The admin cannot leave: `admin_cannot_leave`.
3. The admin can remove another member while `pre_draft`, after confirming. Removing
   someone who is not a member succeeds without change. Removing oneself is refused
   with `cannot_remove_self`; the admin uses transfer or delete instead.
4. After the draft starts, leaving and removal are refused with
   `league_not_pre_draft`.
5. A removed or departed member can rejoin with a valid code while `pre_draft`.

### R6. Admin settings

1. `/leagues/[leagueId]/settings` is for the admin only. Other members get the
   not-found page.
2. **Regenerate code**: creates a new code and invalidates the old one. Only while
   `pre_draft`.
3. **Transfer admin**: the admin picks another current member and confirms. That
   member becomes admin and the former admin becomes a regular member, in one
   transaction. A league always has exactly one admin, enforced by a unique index.
   Transferring to someone already admin succeeds without change. A target who is not
   a member is refused with `target_not_member`.
4. **Delete league**: only while `pre_draft` (changed after F6: any status). The
   admin must type the league name. A
   mismatch is refused with `confirmation_mismatch`. On success the league and its
   members are gone and the user returns home.

### R7. Authorization and access

1. Every write goes through a server route using postgres.js in one transaction
   (`conventions.md`). The browser has select access only.
2. Each route confirms the session, then checks membership and role against current
   data inside the same transaction that writes, holding a lock on the league row.
3. A user who is not a member of a league gets `league_not_found` for any action on it
   other than joining, so existence is not leaked. A member who is not the admin
   gets `not_admin` for admin actions.
4. `leagues` and `league_members` have RLS enabled. Members can select their own
   leagues and every member row in them. Non-members see nothing. No insert, update or
   delete policy exists for users.
5. `profiles` becomes readable for the user's own row and for users who share a
   league with them.
6. All route failures use `{ ok: false, reason }`. No raw database errors reach the
   client.

### R8. Shared API helpers

1. `lib/api/` provides response helpers, a JSON body reader that rejects unknown
   keys, an error type, and a route wrapper that runs the standard order: validate,
   authenticate, run, return.
2. The wrapper maps unexpected errors to `500 internal_error` with no detail.
3. The F1 `PATCH /api/profile` route is moved onto the helpers with its behavior and
   tests unchanged.

### R9. Dev scenarios

The scenarios F2 needs, built by F2.5 (see Appendix): `league_empty`,
`league_with_players`, `league_full`, `member_view`.

5. **Draft date** (added after F2 shipped): the admin can set, change, or clear the
   draft date in Settings while `pre_draft`, via `PATCH /api/leagues/[leagueId]`
   with `{ draftAt }` (`null` clears). Others get `not_admin` or `league_not_found`;
   after the draft starts it is refused with `league_not_pre_draft`.

## Out Of Scope

- Pool, draft date editing, group count, pick timer, and starting the draft.
- Attempt limiting for join codes.
- Archiving leagues, finished-league sections.
- Realtime updates of the member list (arrives with F5).

## Appendix: Dev Scenarios

| Scenario              | State                                                           |
| --------------------- | --------------------------------------------------------------- |
| `league_empty`        | One league, `pre_draft`, the viewer is admin and the only member |
| `league_with_players` | `pre_draft`, the viewer is admin, 11 other members, a draft date |
| `league_full`         | `pre_draft`, 100 members                                         |
| `member_view`         | `pre_draft`, the viewer is a regular member                      |
