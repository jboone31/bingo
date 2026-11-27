# F6: Draft Setup And Start. Design
## Data Model
Migration `0010_draft_setup.sql`, in `begin; ... commit;`.
```sql
alter table public.leagues
  add column group_count int not null default 1 check (group_count between 1 and 10),
  add column pick_seconds int not null default 60
    check (pick_seconds between 10 and 900),
  add column draft_started_at timestamptz;

create table public.draft_groups (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  number int not null check (number between 1 and 10),
  created_at timestamptz not null default now(),
  unique (league_id, number),
  unique (league_id, id)
);

create table public.draft_group_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  group_id uuid not null,
  user_id uuid not null,
  position int not null check (position between 1 and 100),
  created_at timestamptz not null default now(),
  constraint draft_group_members_group_fkey
    foreign key (league_id, group_id)
    references public.draft_groups (league_id, id) on delete cascade,
  constraint draft_group_members_member_fkey
    foreign key (league_id, user_id)
    references public.league_members (league_id, user_id) on delete cascade,
  unique (league_id, user_id),
  unique (group_id, position)
);
```
- Composite foreign keys tie each row to a group and a membership in the same league.
  This is the same pattern as `queue_items`.
- Indexes: `draft_group_members (league_id, group_id, position)`. The unique
  constraints cover the policy filter on `league_id` for `draft_groups`. Add
  `draft_groups (league_id)` only if it is not covered.
- RLS on both tables. Policies `..._select_member` use
  `public.is_league_member(league_id)`. Revoke all from `anon` and `authenticated`,
  then grant select to `authenticated`.
- Trigger `draft_groups_guard` and `draft_group_members_guard` (before insert, update,
  delete):
  - Insert is allowed only while the league row's status is `drafting` and
    `draft_started_at` is set. The start sets both before it inserts.
  - Update is always refused (`draft_groups_immutable`).
  - Delete is allowed only when the league row is gone, meaning the cascade is
    running.
- Trigger `leagues_draft_settings_guard` (before update of `group_count`,
  `pick_seconds` on `leagues`) raises `league_not_pre_draft` when a value changes and
  `old.status <> 'pre_draft'`.
- No Realtime publication for these tables. Groups do not change after the start; F7
  decides group channels.
- All trigger functions: `security definer`, `search_path = ''`, execute revoked from
  `public`, `anon` and `authenticated`.
## Pure Logic: `lib/draft/`
- `settings.ts`: `GROUP_COUNT = { min: 1, max: 10 }`,
  `PICK_SECONDS = { min: 10, max: 900, default: 60 }`. It also has
  `parseGroupCount(value)` and `parsePickSeconds(value)`, which accept integers only;
  strings and fractions are refused. `formatSeconds(s)` returns text such as "45 s",
  "1 min", "2 min 30 s" or "15 min", built without `Intl`.
- `gate.ts`:
  - `requiredPool(n, g) = ceil(n / g) * 25`.
  - `groupSizes(n, g)` returns sizes in descending order, for example 15 and 4 give
    `[4, 4, 4, 3]`.
  - `startGate({ members, groups, pool })` returns `{ ok: true }` or the first failing
    reason, `too_few_players` or `pool_too_small`, with `needed`. Zero members counts
    as `too_few_players`.
- `split.ts`: `splitIntoGroups(userIds, g, randomInt)` shuffles with Fisher-Yates
  using the injected `randomInt(max)`. It deals players round-robin into `g` groups,
  so group 1 to `n mod g` get the extra player, and the order inside each group is
  the shuffled order. The result is `{ number, members: [{ userId, position }] }[]`.
  - The production caller passes `crypto.randomInt`.
  - Tests pass a seeded generator.
- `rules.ts`:
  - `canChangeDraftSettings({ status, actorRole })`: admin only, `pre_draft` only.
  - `canStart({ status, actorRole, members, groups, pool, expected })` returns
    `alreadyStarted` (which the route treats as success), a denial, or allowed.
  - Reasons: `not_admin` (403); `too_few_players`, `pool_too_small` and
    `draft_setup_changed` (409). A league past `pre_draft` is not an error for the
    admin: it is `alreadyStarted`. A non-admin gets `not_admin` in every status.
## Server
- `lib/draft/queries.ts` (server-only), under the caller's league lock:
  - `setDraftSettings(tx, leagueId, { groupCount?, pickSeconds? })` returns whether
    anything changed. It uses `is distinct from` in the `where` clause, the same
    approach as `setDraftAt`.
  - `listMemberIds(tx, leagueId)`.
  - `markStarted(tx, leagueId)` sets `status = 'drafting'` and
    `draft_started_at = now()`, returning that time.
  - `insertGroups(tx, leagueId, split)` is one insert for the groups and one for the
    members, through `unnest`.
- `lib/draft/start.ts` (server-only): `startDraft(tx, leagueId, actorId, expected)`.
  The route and the dev seeding share it.
  1. `lockLeagueForMember`, which holds `for update`.
  2. Count members, count the pool (`countSubmissions`), then run `canStart`.
  3. Call `markStarted`, `splitIntoGroups` and `insertGroups`.
  4. `appendLeagueEvent(draftStarted(g, sizes))`.

  It returns `{ alreadyStarted }` or throws `ApiError`. `lockLeagueForMember` needs
  the new columns, so `LeagueRow` gains `groupCount`, `pickSeconds` and
  `draftStartedAt`.
- `lib/draft/read.ts` (RLS):
  - `getDraftSetup(leagueId)` returns `{ groupCount, pickSeconds, draftStartedAt }`.
  - `getDraftGroups(leagueId)` returns groups with members (display names, positions),
    by embedding profiles through `league_members` or reading names separately.
- `lib/events/payload.ts` gets `draftSettingsChanged(groupCount, pickSeconds)` and
  `draftStarted(groupCount, sizes)`. `describe.ts` gets "Draft settings changed:
  3 groups, 90 s per pick" and "The draft started with 3 groups".
## Routes
- `PATCH /api/leagues/[leagueId]/draft-settings` with body `{ groupCount?,
  pickSeconds? }`. At least one key is required, and unknown keys are refused. The
  route locks the league, checks the rule, saves, and appends
  `draft_settings_changed` with both current values when something changed. It
  returns `{ ok, groupCount, pickSeconds }`.
  - Error reasons: `invalid_group_count` and `invalid_pick_seconds` (400).
- `POST /api/leagues/[leagueId]/start` with body `{ expected: { members, groupCount } }`.
  It calls `startDraft` and returns `{ ok, alreadyStarted? }`.
- New messages in `lib/leagues/messages.ts`: `invalid_group_count`,
  `invalid_pick_seconds`, `too_few_players`, `pool_too_small` and
  `draft_setup_changed` ("Players or groups changed. Check the new numbers and start
  again.").
## Components
- `components/draft/DraftSetupForm.tsx` (client), on the settings page while
  `pre_draft`:
  - It has a group count field, and a pick seconds field with a `formatSeconds` hint.
  - It shows live gate text built from `startGate` and `groupSizes` using the typed
    group count.
  - Save sends only the changed values, then calls `router.refresh()`.
- `components/draft/StartDraftButton.tsx` (client): it wraps `ConfirmAction`, sends
  `expected`, and refreshes after.
  - It is disabled with the reason when the gate fails or the form has unsaved
    changes. The form tells it through a `dirty` prop: both live in one
    `DraftSetupPanel` client component.
- `components/draft/GateSummary.tsx` (server-safe, no `Intl`): the "Groups G · 60 s per
  pick · Pool P / R needed" line for the overview.
- `components/draft/DraftGroups.tsx`: the after-start panel on the overview, with
  groups in order, the viewer's group first, and an "Your group" badge.
- Styles come from tokens and `components/ui` only. At 360px, fields stack.
## Dev Scenarios
- `ScenarioPlan` gains `groupCount` (default 1), `pickSeconds` (60) and `startDraft`
  (false). Existing entries set the defaults.
- `seedScenario` writes `group_count` and `pick_seconds` when the league is created.
  When `startDraft` is set, it calls `startDraft(tx, id, adminId, expected)` after the
  pool is added, in the same transaction.
- New entries are `ready_three_groups`, `pool_short` and `draft_started`, as in R5.
## Testing Plan
- Property tests (fast-check, at least 100 runs):
  - `groupSizes` sums to `n`, has exactly `g` entries, and its sizes differ by at most
    one.
  - `splitIntoGroups` puts every id in exactly one group, has positions 1 to size per
    group, and sizes that match `groupSizes`.
  - `requiredPool` matches the draft-rules examples (15/1 gives 375, 15/3 gives 125)
    and never goes down as `g` grows.
  - `startGate` is ok exactly when `n >= g`, `n >= 1` and `pool >= requiredPool`.
  - `parsePickSeconds` and `parseGroupCount` accept exactly the integers in range.
- Example tests cover `formatSeconds`, the rules (each reason, plus `alreadyStarted`)
  and the event text.
- Route tests (mocked queries, session and events):
  - Validation, auth and each refusal.
  - Settings with an event only on change.
  - Start writes in order (lock, mark, insert, event), a repeat, and
    `draft_setup_changed`.
- Component tests (jsdom):
  - The live gate text as the group count changes.
  - Start is disabled with each reason and while unsaved.
  - The confirmation summary.
  - The groups panel puts the viewer's group first.
- Integration (`test/integration/draftSetup.integration.test.ts`):
  - A real `startDraft` gives a correct split and order in the database, a repeat is a
    no-op, and the event is written.
  - The settings guard refuses changes after the start.
  - Group rows can't be updated, and can't be inserted while `pre_draft`.
  - A member reads groups and a non-member reads none. Direct writes by
    `authenticated` fail. League delete cascades.
  - A start racing a join: run two transactions and confirm that no member joins
    after the start and that every member is in a group.
- Manual (the user): the settings panel and live gate on the seeded scenarios; start
  `ready_three_groups`; check the groups on the overview; confirm that joins and pool
  edits are refused afterwards; check the layout at 360px.
## Steering Updates
- `draft-rules.md`: the timer is 10 to 900 seconds with a default of 60, no longer
  marked as an assumption; the group count is 1 to 10; the draft date does not gate
  the start.
- `product.md`: remove the draft-date open question and record the answer.
- `structure.md`: add `lib/draft/`, `components/draft/`, the two routes and
  migration 0010.
- `roadmap.md`: set the status and the F7 handoff (`draft_started_at`, order tables,
  `pick_seconds`).
