# F4: Pre-Draft Pool And Queue. Requirements

Depends on F2 and F3. Rules referenced: `draft-rules.md` (Pre-Draft, The Draft),
`conventions.md` (Access Model, RLS Policies, Design, Dev Scenarios), `product.md`.

## Decisions Recorded

- **Filter and sort** the pool by category, plus a text search and a choice of sort
  order. It runs on the server through URL parameters, so it works with paging and
  with pools of up to 5,000 squares, and a filtered view can be bookmarked.
- **Categories ignore capitalization**: "sports" and "Sports" are one filter option.
  The option shows one of the original spellings. Squares with no category have their
  own "Uncategorized" option.
- **Queue rules.** One queue per player per league. Players queue individual rows, so
  two squares with identical text are separate entries, and the list shows the
  submitter to tell them apart. A square can be in a queue once.
- **Queue size limit: 200** per player (an assumption, easy to change). A draft is 25
  rounds, so 200 is plenty, and it keeps the page and the saved order small.
- **Removing a square from the pool removes it from every queue.** A player who leaves
  or is removed from the league loses their queue. Deleting a league deletes its
  queues.
- **Queues are private.** Only the owner can read a queue, not other members and not
  the admin.
- **Re-ordering** works by dragging a handle (touch and mouse) and by up and down
  buttons (keyboard, or anyone who finds dragging fiddly). Every change is saved
  automatically.
- **Editable while `pre_draft`.** F7 extends this to during the draft, as
  `draft-rules.md` requires.
- **Search covers the square text only** in F4. Submitter appears as a sort option.
- The queue stores a **position** per item. Positions can have gaps after removals;
  the screen numbers items by their place in the list.
- Dragging uses the `@dnd-kit` libraries (core, sortable, utilities): they support
  touch, mouse and keyboard, and screen reader announcements.

## User Stories And Acceptance Criteria

### R1. Browse the pool with filter, sort and search

As a member, I narrow the pool to find squares I want.

1. The pool page has a filter bar with: category (All, each category with its count,
   Uncategorized), a text search, and a sort choice (Order added, Text, Submitter,
   Category).
2. The bar is a plain form that submits through the URL (`?cat=&q=&sort=&page=`). It
   works without client JavaScript. A Clear link resets it.
3. `cat` missing or empty means all categories; `cat=none` means Uncategorized;
   `cat=c:sports` means that category, matched ignoring case. The `c:` prefix means a
   category can never be mistaken for the special values, and a plain form can submit
   "All".
4. `q` is matched against square text, ignoring case, as a literal substring. Typing
   `%`, `_`, quotes or `*` matches those characters and cannot break the query. Over
   100 characters is cut to 100.
5. Unknown or malformed parameters fall back to defaults. They never cause an error.
6. The result count reflects the filter ("12 of 300 squares"). Paging keeps the filter
   and sort in its links, and the page number is clamped.
7. Sorting is stable: rows that tie keep their added order.
8. An empty result shows "No squares match" with a link to clear the filter.
9. The category list comes from the whole pool, not the current page.

### R2. Add to and remove from the queue from the pool

1. Every member sees a button on each square: **Add to queue**, or **Queued** with a
   remove option once it is in their queue.
2. The button responds immediately, then confirms with the server. If the server
   refuses, the button returns to its previous state and a message explains why.
3. Adding a square that is already queued succeeds without change. Removing a square
   that is not queued succeeds without change.
4. A full queue (200) refuses with `queue_full`.
5. After the draft starts, the buttons are hidden (read only until F7).
6. The admin queues like any other member.

### R3. The queue page

1. `/leagues/[leagueId]/queue` shows the member's queue in order: position number,
   square text, submitter, category.
2. The queue can be re-ordered by dragging the handle on a row, and by Move up and Move
   down buttons. Drag handles do not interfere with scrolling on a touch screen.
3. Each change updates the screen immediately and saves in the background. If saving
   fails, the list returns to the last saved order and a message is shown.
4. Quick successive changes are saved in order and never lose the latest one.
5. If the queue was changed elsewhere (another tab), saving is refused with
   `queue_changed`, the page reloads the current queue, and the player is told.
6. A row has a Remove button. The page shows the count ("12 of 200").
7. An empty queue shows an empty state with a link to the pool.
8. After the draft starts the page is read only.

### R4. Access and privacy

1. All queue writes go through server routes in one transaction. Each locks the
   caller's own membership row, confirms the league is `pre_draft`, then writes.
2. Non-members get `league_not_found` for every queue action.
3. `queue_items` has RLS enabled with a select policy that matches the **owner**, not
   the league. No insert, update or delete policy exists for users.
4. A queue item can only point at a submission in the same league, and only for a
   member of that league. The database enforces both.
5. The category summary view applies the same visibility as the pool.
6. Failures use `{ ok: false, reason }`. No raw database error reaches the client.

### R5. Rules the database enforces

1. Queue changes are refused once the league is not `pre_draft`.
2. A submission appears at most once in a queue, and a position is used at most once.
3. A queue holds at most 200 items.
4. Deleting a submission, leaving or being removed from a league, or deleting a league
   removes the matching queue items.

### R6. Navigation and the draft date

1. League navigation gains a **Queue** item for every member.
2. The pool and queue pages show the draft date in the viewer's time zone, or "Draft
   date to be set".
3. The league overview shows how many squares are in the viewer's queue, with a link.

### R7. Shared components

1. The filter bar, the pool list with queue buttons, and the queue list are built so
   F8's draft room can reuse them: they take the league id and a base path and do not
   assume the pool page.
2. The filter parsing, the order helpers and the queue rules live in `lib/` as pure
   functions with tests.

### R8. Dev scenario

New scenario (see Appendix): `queue_started`.

## Out Of Scope

- Changing the queue during the draft (F7) and live queue updates (F8).
- Auto-pick (F7).
- Adding many squares at once, clearing the queue, moving to the top, or sharing a
  queue.
- Searching submitter names.

## Appendix: Dev Scenario

| Scenario        | State                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| `queue_started` | `pre_draft`, you are admin, 11 players, 60 squares (as `league_with_pool`), your queue holds 8 squares in a scrambled order, and each seed player has a queue of 10, so later features have queues to work with |
