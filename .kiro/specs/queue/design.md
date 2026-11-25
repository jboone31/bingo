# F4: Pre-Draft Pool And Queue. Design

## Overview

A `queue_items` table owned by one member, a category summary view, pure code for
filter parsing, ordering and queue rules, four small routes, a filter bar on the pool
page, a queue page with drag-and-drop, and queue buttons on pool rows.

## Data Model

Migration `0007_queue.sql`:

```sql
begin;

-- Lets queue_items point at a submission AND prove it is in the same league.
alter table public.submissions
  add constraint submissions_league_id_id_key unique (league_id, id);

create table public.queue_items (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  user_id uuid not null,
  submission_id uuid not null,
  position integer not null check (position >= 1),
  created_at timestamptz not null default now(),
  constraint queue_items_member_fkey
    foreign key (league_id, user_id)
    references public.league_members (league_id, user_id) on delete cascade,
  constraint queue_items_submission_fkey
    foreign key (league_id, submission_id)
    references public.submissions (league_id, id) on delete cascade,
  constraint queue_items_one_per_submission
    unique (league_id, user_id, submission_id),
  constraint queue_items_one_per_position
    unique (league_id, user_id, position) deferrable initially deferred
);

create index queue_items_owner_idx
  on public.queue_items (user_id, league_id, position);
create index queue_items_submission_idx
  on public.queue_items (league_id, submission_id);

alter table public.queue_items enable row level security;

create policy queue_items_select_own on public.queue_items
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Distinct categories (ignoring case) with counts, for the filter. security_invoker
-- makes the view obey submissions' RLS, so only league members see a league's rows.
create view public.pool_categories with (security_invoker = true) as
  select league_id,
         lower(category) as key,
         min(category) as label,
         count(*)::int as count
  from public.submissions
  group by league_id, lower(category);

revoke all on table public.queue_items from anon, authenticated;
grant select on table public.queue_items to authenticated;
revoke all on public.pool_categories from anon, authenticated;
grant select on public.pool_categories to authenticated;

-- triggers below
commit;
```

Notes:

- Two composite foreign keys give two guarantees in the database itself: only a
  **member** can have queue items, and an item can only point at a submission in the
  **same league**. Both cascade, so leaving a league, deleting a submission and
  deleting a league clean up queues (and satisfy the cascade rule in
  `conventions.md`).
- The position uniqueness is `deferrable initially deferred`, so a reorder can rewrite
  all positions in one statement; the check happens at commit.
- The select policy matches the owner, as `conventions.md` requires for private data.
  Its filter columns are the leading columns of `queue_items_owner_idx`.
- `pool_categories` needs PostgreSQL 15 or newer for `security_invoker`. Supabase
  projects are on 15+. An integration test proves a non-member sees nothing.
- No Realtime publication yet. F8 adds it when the draft room subscribes.

Trigger `queue_items_guard` (before insert, update, delete; `security definer`,
`search_path = ''`, execute revoked from `public`, `anon`, `authenticated`):

- Look up the league's status. If the league row is missing (the league is being
  deleted and this is the cascade), allow. If the status is not `pre_draft`, raise
  `league_not_pre_draft`. F7 replaces this with a rule that also allows `drafting`.
- On update, raise `queue_item_immutable` if `league_id`, `user_id` or
  `submission_id` changed. Only `position` may change.
- On insert, raise `queue_full` if the owner already has 200 items in the league.

## Pure Logic

### `lib/pool/query.ts`

```ts
type CategoryFilter =
  | { kind: "all" }
  | { kind: "none" }                 // Uncategorized
  | { kind: "named"; key: string };  // lowercased
type SortKey = "added" | "text" | "submitter" | "category";
interface PoolQuery { category: CategoryFilter; q: string; sort: SortKey }
```

- `parsePoolQuery(raw: Record<string, string | string[] | undefined>): PoolQuery`.
  Reads `cat`, `q`, `sort`. `cat` missing or empty is all, `none` is Uncategorized,
  `c:<name>` is a named category (trimmed, lowercased, whitespace collapsed, cut to 40);
  anything else is all. `q` is trimmed and cut to 100.
  `sort` outside the four values is `added`. Arrays use the first value. Never throws.
- `poolQueryToParams(query, page?): URLSearchParams` omits defaults, so links stay
  short, and round-trips: `parsePoolQuery(toObject(poolQueryToParams(q))) equals q`.
- `searchPattern(q): string` turns the term into an `ilike` pattern: escape `\`, `%` and
  `_` with a backslash, strip `*` (PostgREST treats `*` as a wildcard), and wrap in `%`.
  The result never contains an unescaped wildcard from the user.
- `groupCategories(rows)` is not needed: the view already groups.
- `describeFilter(query): string[]` lists active filters for the "No squares match"
  message.

### `lib/queue/order.ts`

- `moveItem(ids, from, to): string[]` returns a new array, clamping `to`. A move to the
  same place returns an equal array.
- `moveById(ids, id, delta: -1 | 1)` for the buttons; the first item cannot move up and
  the last cannot move down.
- `isPermutation(a, b): boolean` is true when the arrays hold the same ids exactly once.
- `sameOrder(a, b)`.

### `lib/queue/rules.ts`

Decisions over plain data, like the other `rules.ts` files:

- `canEditQueue({ status })`: `league_not_pre_draft` (409) unless `pre_draft`.
- `canAddToQueue({ status, count })`: the above plus `queue_full` (409) at 200.
- `QUEUE_MAX = 200`.

## Server Data Access (`lib/queue/queries.ts`, server-only)

- `lockMemberForQueue(tx, leagueId, userId)`: one statement,
  `select l.status from leagues l join league_members m on m.league_id = l.id
   where l.id = $1 and m.user_id = $2 for share of l for update of m`. No row means not
  a member (or no league). It holds the league row `for share`, so the draft start
  (which locks the league row for update) cannot interleave with a queue write, and
  holds the member row `for update`, so one player's queue writes run one at a time.
  Other players' writes do not block each other.
- `submissionInLeague(tx, leagueId, submissionId)`.
- `getQueueIds(tx, leagueId, userId)`: ordered by position.
- `insertQueueItem(tx, leagueId, userId, submissionId)`: position
  `coalesce(max(position), 0) + 1`, `on conflict (league_id, user_id, submission_id) do
  nothing returning id`. Returns whether a row was added.
- `deleteQueueItem(tx, leagueId, userId, submissionId)`.
- `rewriteOrder(tx, leagueId, userId, ids)`:
  `update queue_items q set position = t.n from unnest($3::uuid[]) with ordinality as
  t(submission_id, n) where q.league_id = $1 and q.user_id = $2 and q.submission_id =
  t.submission_id`.

## Routes

Under `app/api/leagues/[leagueId]/queue/`, Node.js runtime, built on `handle`.

| Method and path                   | Body                  | Result                                              |
| --------------------------------- | --------------------- | --------------------------------------------------- |
| `POST .../queue`                  | `{ submissionId }`    | `201 { ok, queued: true }`, repeat `200 { ok, queued: false }` |
| `DELETE .../queue/[submissionId]` | none                  | `200 { ok }`                                        |
| `PUT .../queue`                   | `{ order: string[] }` | `200 { ok }`                                        |

Order of work: validate (UUIDs, `order` has at most 200 unique UUIDs, unknown keys
rejected), authenticate, then one transaction: `lockMemberForQueue`, rules, write.

- **Add**: if the submission is not in this league, `404 submission_not_found`. Then
  `canAddToQueue` with the current count, then insert. Already queued returns 200.
- **Remove**: a missing item is success.
- **Reorder**: `order` must be a permutation of the current queue. Otherwise `409
  queue_changed` and nothing is written. Repeating the same order is harmless.
- Non-members get `404 league_not_found`. After the draft starts, `409
  league_not_pre_draft`.

New reasons: `queue_full`, `queue_changed`. `submission_not_found` already exists.
`lib/leagues/messages.ts` gains their text.

## Reads (`lib/pool/read.ts`, `lib/queue/read.ts`, RLS client)

- `getPoolPage(leagueId, query, rawPage)`: extends the F3 function. Filters:
  category `all` none; `none` `.eq("category", "")`; `named` `.ilike("category", escaped
  key)` (exact, case-insensitive, with `\`, `%`, `_` escaped); `q` `.ilike("text",
  searchPattern(q))`. Sort: `added` by `seq`; `text`, `submitter`, `category` by that
  column then `seq`. Count uses the same filters (`count: "exact"`). Returns items,
  filtered total, unfiltered total, page, page count.
- `listCategories(leagueId)`: `from("pool_categories").select("key, label, count")`
  filtered by league, ordered by label. The empty key is the Uncategorized option.
- `getQueue(leagueId, userId)`: `from("queue_items").select("position, submission_id,
  submissions!queue_items_submission_fkey(id, text, submitter, category)")` ordered by
  `position`. The constraint name picks the right relationship for the embed. At most
  200 rows, so the API's row limit is not a concern.
- `getQueuedIds(leagueId, userId, submissionIds)`: which of a page's rows are queued.
- `countQueue(leagueId, userId)` for the overview.

## Pages

```
app/(app)/leagues/[leagueId]/pool/page.tsx    filter bar, list with queue buttons
app/(app)/leagues/[leagueId]/queue/page.tsx   the queue
```

League layout gains `{ href: ".../queue", label: "Queue" }` for every member.
The overview shows "Queue: N squares" with a link. Both pages show a
`DraftDateLine` (`components/leagues/DraftDateLine.tsx`): "Draft: <LocalTime>" or
"Draft date to be set".

Pool list rows pass `canQueue` (member, `pre_draft`) and the set of queued ids.

## Components

| Component | Where | Notes |
| --- | --- | --- |
| `PoolFilterBar` | `components/pool/` | Server component. A `<form method="get" action={basePath}>` with a category `Select`, a search `TextField`, a sort `Select`, Apply and Clear. Works without JavaScript. Keeps no page number (a new filter starts on page 1). |
| `SubmissionList` | `components/pool/` | Extended: optional `canQueue` and `queuedIds`; renders `QueueToggle` per row. |
| `QueueToggle` | `components/queue/` | Client. Optimistic: flips at once, calls `POST` or `DELETE`, rolls back with a toast on failure, then `router.refresh()`. |
| `QueueList` | `components/queue/` | Client. `@dnd-kit` `DndContext`, `SortableContext`, one `QueueRow` per item. Props: `leagueId`, `items`, `editable`. |
| `QueueRow` | `components/queue/` | Position number, text, submitter, category badge, drag handle, Move up, Move down, Remove. The handle alone starts a drag (`touch-action: none` on it only), so the rest of the row scrolls normally on touch. |
| `ui/Pagination` | existing | Gains an optional `params` prop so links keep the filter. |
| `DraftDateLine` | `components/leagues/` | Shared by pool and queue pages. |

All take the league id and no page-specific assumptions, so F8 can mount
`QueueList` and the filter bar with its own base path.

### Saving the order

`QueueList` keeps `order` in state, initialised from props (and reset when the props
change after a refresh).

1. A drag end or a Move button computes the new order with `moveItem` and sets it at
   once.
2. A saver sends `PUT { order }`. While one request is in flight, further changes only
   update a "latest wanted" order. When the request finishes, if the latest differs from
   what was saved, it sends again. So quick changes never overlap and the last one wins.
3. On failure the list returns to the last saved order and shows a toast. On
   `queue_changed` it calls `router.refresh()` and says the queue changed elsewhere.
4. Remove calls `DELETE`, removes the row locally, and refreshes.

Keyboard: the sortable uses `sortableKeyboardCoordinates` (space to lift, arrows to
move, space to drop) and dnd-kit's screen reader announcements. The buttons are the
primary non-drag path.

## Dev Scenario

`ScenarioPlan` gains `viewerQueueSize` and `fakeQueueSize` (both default 0).
`seedScenario` builds queues after the pool: `seedQueueOrder(count, size, salt)` (pure,
in `lib/dev/scenarios.ts`) picks `size` distinct indexes by stepping through the pool
with a stride coprime to its length, so the order looks scrambled but is deterministic.
`queue_started`: pool 60, viewer queue 8, seed players 10 each.

## Testing

Offline:

- `parsePoolQuery`: examples for each parameter, `cat` absent versus empty, junk sort,
  arrays, over-long values. Property: never throws; the output always satisfies the
  limits; `poolQueryToParams` then parse returns the same query.
- `searchPattern`: property that for any input, the pattern starts and ends with `%`
  and every `%`, `_` or `\` from the input is preceded by a backslash; no `*` remains.
- `order`: `moveItem` keeps the same set of ids, is reversible, clamps; `isPermutation`
  properties.
- `rules`: tables and properties (draft started refuses everything; the cap boundary at
  exactly 200).
- `seedQueueOrder`: distinct, in range, deterministic, for any size up to the pool size.
- Route tests (session and queries mocked): bad input, 401, non-member 404, 404 for a
  submission outside the league, repeat add and remove, `queue_full`,
  `queue_changed` writes nothing, 409 after the start, no raw error text.
- Component tests: `QueueToggle` (optimistic flip, rollback on failure), `QueueRow` and
  `QueueList` buttons (move up and down update the order and call the saver; the first
  and last disable correctly; quick changes send once at a time with the last one
  winning; failure restores; `queue_changed` refreshes), `PoolFilterBar` (fields reflect
  the query, form is a GET), `Pagination` with params.
- Page smoke tests for the pool filters (query passed through, empty result state) and
  the queue page (empty state, read only after the start).
- Dragging itself is not unit tested (jsdom has no layout); it is covered by the manual
  check on a phone and a laptop.

Integration (`test/integration/queue.integration.test.ts`):

- Owner reads their queue; another member, a non-member and anon read nothing, and the
  admin cannot read a member's queue.
- No direct writes succeed.
- A queue item cannot point at a submission in another league (foreign key), a
  non-member cannot have one, and the same submission twice is rejected.
- The 201st item is refused; exactly 200 succeeds.
- Changes are refused once the league is not `pre_draft`; a league with queues can
  still be deleted.
- Deleting a submission, removing a member, and deleting a league each remove the
  matching queue items.
- `rewriteOrder` reorders in one transaction despite the unique position constraint.
- `pool_categories` groups ignoring case, counts correctly, shows members their league's
  rows and non-members none.
- PostgREST behavior that unit tests cannot see: the embed
  `submissions!queue_items_submission_fkey` and the `ilike` search with `%`, `_` and
  quotes, using a real user session from the dev tools. (Run with the service-role
  suites.)

## Structure And Convention Updates

- `structure.md`: `lib/queue/`, `components/queue/`, the queue routes and page; `lib/pool/query.ts`.
- `tech.md`: list `@dnd-kit` as the drag-and-drop library under the stack.
- `conventions.md`: add to Database: private per-player data uses an owner select
  policy and composite foreign keys that tie it to league membership.
- `roadmap.md`: record decisions; mark F4 Done when shipped.
