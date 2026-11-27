# F7: Draft Engine And Timers. Design
## Data Model
Migration `0011_draft_engine.sql`, in `begin; ... commit;`.
```sql
alter table public.leagues
  add column draft_completed_at timestamptz,
  add column dev_bots boolean not null default false,
  add constraint leagues_dev_bots_seed_only
    check (not dev_bots or seed_scenario is not null);

-- Mutable per-group state, written only by the engine functions.
create table public.draft_clocks (
  group_id uuid primary key,
  league_id uuid not null,
  next_pick int not null default 1 check (next_pick >= 1),
  total_picks int not null check (total_picks between 25 and 2500),
  turn_started_at timestamptz not null,
  deadline timestamptz,          -- null once finished
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint draft_clocks_group_fkey foreign key (league_id, group_id)
    references public.draft_groups (league_id, id) on delete cascade,
  check ((finished_at is null) = (deadline is not null))
);

create table public.draft_picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  group_id uuid not null,
  pick_number int not null check (pick_number >= 1),
  round int not null check (round between 1 and 25),
  user_id uuid not null,
  submission_id uuid not null,
  auto boolean not null,
  made_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint draft_picks_group_fkey foreign key (league_id, group_id)
    references public.draft_groups (league_id, id) on delete cascade,
  constraint draft_picks_submission_fkey foreign key (league_id, submission_id)
    references public.submissions (league_id, id) on delete cascade,
  constraint draft_picks_member_fkey foreign key (league_id, user_id)
    references public.league_members (league_id, user_id) on delete cascade,
  constraint draft_picks_one_per_number unique (group_id, pick_number),
  constraint draft_picks_one_per_square unique (group_id, submission_id)
);
create index draft_picks_league_idx on public.draft_picks (league_id, group_id, pick_number);
create index draft_clocks_league_idx on public.draft_clocks (league_id);
create index draft_clocks_due_idx on public.draft_clocks (deadline) where finished_at is null;
```
- RLS on both tables. Member select policies use `is_league_member(league_id)`.
  Revoke everything from `anon` and `authenticated`, then grant select.
- `draft_picks_immutable` (before update) raises. Deletes come only from the cascades.
- `league_members_guard_delete` (before delete on `league_members`) raises
  `league_not_pre_draft` when the league row still exists and its status is not
  `pre_draft`. The league cascade still passes, because the row is gone by then.
- `queue_items_guard` is replaced: changes are allowed in `pre_draft` and `drafting`,
  and refused in `in_progress`. The cascade case and the 200 cap are unchanged.
- No Realtime publication for the new tables. Clients learn from `league_events`.
- View `available_submissions` (`security_invoker`, so `submissions` RLS applies):
  submissions minus those picked in the caller's group, but only while the league is
  `drafting`. Otherwise it is the whole pool. It uses `(select auth.uid())` against
  `draft_group_members`. `available_pool_categories` does the same for the category
  counts. Both get `grant select` to `authenticated`. The pool page reads these views,
  so the pool hides a square for its group and no other group is affected.

## Engine Functions
All are `security definer`, `search_path = ''`, with execute revoked from `public`,
`anon` and `authenticated`. The server role calls them through postgres.js, and
`pg_cron` calls them as the owner.
- `draft_on_clock(p_pick int, p_size int) returns int`: the position on the clock,
  under the snake rule. Immutable.
- `create_draft_clocks(p_league uuid)`: one clock per group, with
  `total_picks = 25 x size`, `turn_started_at = draft_started_at` and
  `deadline = draft_started_at + pick_seconds`. It skips groups that already have a
  clock. `startDraft` calls it after `insertGroups`, and the migration calls it to
  backfill drafting leagues without clocks (`draft_started_at` taken as `now()` for
  those).
- `draft_record_pick(p_group uuid, p_submission uuid, p_auto bool, p_basis
  timestamptz)` (internal). Under the league lock the caller holds, it:
  1. inserts the pick for the current `next_pick`, with `round` and the user on the
     clock;
  2. deletes the square from the queues of all the group's members;
  3. advances the clock: `next_pick + 1`, `turn_started_at = p_basis`,
     `deadline = p_basis + pick_seconds`, or finishes it;
  4. appends `pick_made`, and `group_finished` when the group is done;
  5. calls `draft_complete_if_done(league)`.
- `draft_auto_choice(p_group uuid) returns uuid`: the first queue item of the user on
  the clock, by position, that has no pick in the group. Otherwise a random submission
  in the league with no pick in the group (`order by random() limit 1`).
- `draft_complete_if_done(p_league)`: if the league is `drafting` and every clock is
  finished, it sets `status = 'in_progress'` and `draft_completed_at = now()`, then
  appends `draft_completed`. **F10 adds board generation here.**
- `settle_league(p_league uuid) returns int`. It locks the league `for update`; if the
  league is not `drafting` it returns 0. Then it loops:
  - It finds a running clock that is **due**: `deadline <= now()`, or bots are on and
    the user on the clock is a seed user.
  - For each due clock it auto-picks with `p_basis = least(deadline, now())`. A missed
    deadline keeps the schedule; a bot pick uses the time of the pick.
  - It stops when no clock is due, and returns the number of auto-picks.
  - The loop always ends: every pass makes a pick, and there are at most
    `total_picks` per group.
- `draft_pick(p_league, p_user, p_submission, p_pick int) returns text`. It calls
  `settle_league` first, then checks the rules in R2 in order:
  - It returns `'already_picked'` when the pick at `p_pick` exists with the same user
    and square.
  - It raises `draft_not_running`, `not_your_turn`, `stale_pick`,
    `submission_not_found` or `square_taken` for a refusal.
  - Otherwise it calls `draft_record_pick(..., false, now())` and returns `'picked'`.
- `is_seed_user(p_user uuid) returns boolean`: the reserved email pattern
  `^seed-player-[0-9]{3}@bingo-seed\.test$` **and** `raw_user_meta_data->>'seed' =
  'true'`, the same rule as `isSeedUser` in `lib/dev/seedIdentity.ts`.
- `settle_due_drafts() returns int` (the cron entry point). It selects drafting
  leagues that have a running clock with `deadline <= now()`, or `dev_bots`, using
  `for update skip locked`. It runs `settle_league` for each inside its own
  `begin ... exception when others` block, so one failure doesn't stop the rest, and
  raises a `warning` for the failure. It returns the total number of picks.
- `dev_draft_advance(p_league, p_picks_per_group int)`: dev seeding only. It forces
  that many auto-picks in each group, regardless of deadlines, with the basis
  `now()`.
- Schedule: `cron.schedule('bingo_draft_settle', '5 seconds', 'select
  public.settle_due_drafts()')`. It unschedules any earlier job of that name first,
  following the guarded pattern in BBB's 0007. Seconds schedules need pg_cron 1.5 or
  later. The migration checks `extversion`, and if the version is older it fails with
  a message rather than falling back silently.

### Events (payloads)
- `pick_made`: `{ group, round, pickNumber, userId, name, submissionId, text, auto,
  next: { pickNumber, userId, name, deadline } | null }`. The `text` is the square's
  text, at most 200 characters, so the feed reads without a lookup. `userId` is the
  subject of the event.
- `group_finished`: `{ group }`.
- `draft_completed`: `{ groups }`.
- `describeEvent`:
  - "Group 2, round 3: Sam picked "Team X wins"", with " (auto)" added for auto-picks;
  - "Group 2 finished its draft";
  - "The draft is complete".

## Pure Model: `lib/draft/engine.ts`
It mirrors the SQL for property tests:
- `onClock(pick, size)` returns `{ round, position }`;
- `totalPicks(size)`;
- `nextDeadline({ kind: "manual" | "auto", at, deadline, pickSeconds })`;
- `autoChoice(queue, taken, pool, random)`;
- `settle(state, now, options)`, which runs the loop over an in-memory league and
  returns the new state plus the picks made.

## Server
- `lib/draft/engine.server.ts` (server-only) wraps the functions:
  - `settleLeague(tx, leagueId)`;
  - `makePick(tx, leagueId, userId, submissionId, pickNumber)`;
  - `devExpire(tx, leagueId)`;
  - `setDevBots(tx, leagueId, on)`;
  - `devAdvance(tx, leagueId, n)`.

  It maps the raised reasons to `ApiError` (409; 404 for `submission_not_found`).
  Unknown database errors pass through to `handle`'s 500.
- `startDraft` also calls `create_draft_clocks`.
- `lib/pool/read.ts`: `getPoolPage` and `listCategories` read the `available_` views.
  `countPool` (the start gate) keeps counting the whole pool.
- `lib/draft/read.ts` gets `getDraftStatus(leagueId)` (RLS): clocks with the user on
  the clock and their name, plus the last 5 picks per group.
- Queue routes (`POST`, `PUT`, `DELETE`): when the league is `drafting`, call
  `settleLeague` before `lockMemberForQueue`, in the same transaction. Both lock the
  league, `for update` then `for share`, in the same transaction. `canEditQueue`
  allows `drafting`.
  - Adding during `drafting` checks `square_taken` against the caller's group's picks
    (`lib/queue/queries.ts` `pickedInMyGroup`).

## Routes
- `POST /api/leagues/[leagueId]/draft/pick` with body `{ submissionId, pickNumber }`.
  It runs `lockLeagueForMember` (404 for non-members), then `makePick`. It returns
  `{ ok, pickNumber, alreadyPicked? }`.
- `POST /api/leagues/[leagueId]/draft/settle` with body `{}`. It runs
  `lockLeagueForMember`, then `settleLeague`, and returns `{ ok, now, picks }`.
- `POST /api/dev/draft` with body `{ leagueId, action: "expire" | "bots_on" |
  "bots_off" }`. It runs `assertDevTools`, requires a tagged seed league that the
  caller is a member of (404 otherwise), and settles afterwards.
- New messages: `draft_not_running`, `not_your_turn`, `stale_pick` and `square_taken`.

## Components
- `components/draft/DraftStatus.tsx` (server-rendered list with client countdowns):
  groups with the viewer's first, "Round r, pick p of t", the player on the clock with
  `<Countdown deadline>`, and the last 5 picks. A completed draft shows "The draft is
  complete".
- `components/draft/Countdown.tsx` (client) uses `useServerNow()`, ticks every 250 ms
  and shows `m:ss`.
  - At zero, it waits a random 0 to 1000 ms, then posts to `/draft/settle` once per
    deadline value.
  - The resulting events refresh the page through `ActivityFeed`.
  - The server render shows the static text "Deadline" with `LocalTime`, which avoids
    a hydration mismatch.
- `components/dev/DevDraftPanel.tsx` (client) shows only when dev tools are on and the
  league is a seed league. It has an Expire button and a Bots toggle.

## Dev Scenarios
- `ScenarioPlan` gains `advanceRounds` (default 0), `expireTurns` (false) and
  `devBots` (false).
- After `startDraft`, seeding:
  - calls `dev_draft_advance` with `advanceRounds x size` for each group;
  - when `expireTurns` is set, sets the deadlines to `now() - 1 second`;
  - sets `dev_bots`.

  Groups of unequal size advance by rounds, so the forced count is per group.
- `draft_mid`: advance 2 rounds, bots on. `draft_expired`: expire turns.
  `draft_last_round`: advance 24 rounds.

## Testing Plan
- **Property tests** (fast-check, at least 100 runs, `lib/draft/engine.test.ts`):
  - The snake rule: each round visits every position once, odd rounds ascend, even
    rounds descend, and pick `k x r` ends a round.
  - A settle over random deadlines, bot flags and queues:
    - it terminates;
    - no square is picked twice in a group;
    - each turn is made by the user on the clock;
    - nothing due is left afterwards;
    - settling twice adds nothing;
    - with everything expired, each group ends with 25 picks per player.
  - `autoChoice` takes the first available queue item, else a pool square that is not
    yet taken.
- **Example tests:** `nextDeadline` for manual, auto and bot cases, and event text.
- **Route tests:** pick, with each refusal and a repeat; settle; dev draft; queue
  routes in `drafting` (allowed, settle called first, `square_taken`) and in
  `in_progress` (refused).
- **Component tests:** the countdown display and a single nudge per deadline (fake
  timers and a mocked clock); the Draft status ordering and the complete state.
- **Integration** (`test/integration/draftEngine.integration.test.ts`):
  - The SQL snake order matches `onClock` for group sizes 1 to 7.
  - A manual pick: its effects on the clock, queues and events; refusals; a repeat.
  - Settle after an expired deadline gives exactly one auto-pick from the queue, and a
    random pick when the queue is empty.
  - A cascade over several expired turns.
  - Two concurrent settles give no double pick.
  - A full draft by forced advance completes once, with `in_progress`,
    `draft_completed_at` and the event.
  - Bots pick seed users only.
  - `settle_due_drafts` settles a due league and skips one that isn't due.
  - The membership delete guard.
  - Queue edits while `drafting` are allowed and refused while `in_progress`.
  - RLS reads for members and non-members, and refused client writes.
  - The cron job exists with a 5-second schedule.
- **Manual (the user):**
  - `draft_mid`: watch the bots pick, and see your own turn count down.
  - `draft_expired`: the backstop picks within about 5 seconds with no tab open.
    Reload to see it.
  - `draft_last_round`: turn bots on and watch the league reach complete.
  - Check the panel at 360px.

## Steering Updates
- `conventions.md`: the engine exception (SQL functions with a TypeScript model), and
  the rule that every draft write settles first.
- `tech.md`: answer "how groups map onto channels" (one league channel), and note the
  pg_cron schedule.
- `draft-rules.md`:
  - picked squares leave group queues;
  - the deadline rules;
  - memberships are locked after the start;
  - queues are read only once the league is `in_progress`.
- `structure.md`: the new modules, routes and migration. `roadmap.md`: the status and
  the F8 and F10 handoffs.
