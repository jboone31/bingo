# Draft Rules

The domain rules for leagues, the draft, and boards. These are the source of truth
for behavior. Specs refine them but should not contradict them. Items marked
**(assumption)** are working defaults that can be changed.

## Leagues And Membership

- Only the admin can delete a league, and only during `pre_draft`.
- Anyone signed in can create a league and becomes its admin. The admin also
  plays: they are a member and count in `N`.
- Others join through an invite link or join code and are regular players.
- A player can be in many leagues.
- Joining is allowed only before the draft starts. After the start, nobody can join.
- A league runs one draft.
- A league has a status: `pre_draft`, `drafting`, `in_progress`. It only moves
  forward. `in_progress` begins when boards are generated at the end of the draft.
- The admin can remove another member during `pre_draft`.
- A player can leave a league during `pre_draft`. The admin cannot leave without
  transferring admin (optional for the MVP) or deleting the league.

## Submission Pool

- Only the admin adds, edits, removes, or recategorizes submissions, and only
  before the draft starts.
- Each submission has text, a submitter (free text set by the admin), and a category.
- The admin can bulk-load by CSV (columns: submission text, submitter, category) or
  add one at a time. A league can be created with an empty pool.
- Submitter names are always visible to players.
- Duplicates are allowed. Every submission has a unique row id, so identical text is
  still a distinct square. Cleaning up is the admin's job (edit or delete rows).
- A CSV upload adds to the pool; it never replaces it. An upload with any invalid
  row imports nothing.

## Pre-Draft

- Every member can view the full pool, and filter and sort it by category.
- Every member keeps a personal queue: an ordered list of squares they want. They add
  from the pool and drag to re-rank.
- A queue is private to its owner, holds up to 200 squares, and is edited while
  `pre_draft` (and during the draft, from F7). Removing a square from the pool removes
  it from every queue.
- The admin sets a draft date. It is shown to all members. It does not gate the
  start: the admin starts whenever they choose.
- The admin sets the number of draft groups (1 to 10, default 1) and can change it
  any time before the start. "At least as many players as groups" is checked at the
  start.

## Starting The Draft

- The admin starts the draft after an explicit confirmation. The start is refused if
  the player or group count changed since the admin confirmed it. A one-player league
  can start.
- **Start gate**: the pool must hold at least `ceil(N / G) x 25` submissions, where
  `N` is the number of members and `G` the number of groups. The admin screen shows
  this number as `G` changes. Example: 15 players in 1 group need 375; 15 players in
  3 groups need 125.
- On start, members are split at random into `G` groups whose sizes differ by at most
  one (each group has `floor(N / G)` or `ceil(N / G)` players).
- Each group drafts from the full pool. A square is available in a group until it is
  picked there. No rows are copied per group.

## The Draft

- All groups draft at the same time. Groups do not affect each other.
- Within a group, the draft is a **snake**: the order reverses each round. The
  starting order is random per group.
- A square can be drafted once per group. It stays available in other groups.
- There are **25 rounds**, one pick per player per round.
- Each pick has a time limit set by the admin per league before the start: a whole
  number of seconds from 10 to 900 (15 minutes, for slow drafts), default 60.
- **Auto-pick**: if the clock runs out, the top square in the player's queue that is
  still available is drafted immediately. If the queue has nothing available, a random
  available square is drafted.
- The clock keeps running whether or not the player is connected. A draft always
  finishes.
- A player can see the remaining squares, their queue, and their own picks, and can
  view other players' confirmed picks. Their own group is shown separately from other
  groups.
- A player can add to, remove from, and reorder their queue during the draft.
- A player can search the pool to see where a square ended up.
- The live feed shows recent events. A full-screen group-wide feed is available for a
  shared display.

## Boards

- A 5x5 board is generated for every player once all groups have finished.
- A player's round-1 pick goes in the **center square**.
- For rounds 2 to 25, each round maps to one board position. The mapping is the same
  for every player. Which round lands on which position is random.
- The mapping is chosen once per league, when boards are generated, and is hidden
  from players until then.
- Players view their card, export it as a PNG, and can export the full draft results
  as CSV. The CSV is for the admin's analysis.
