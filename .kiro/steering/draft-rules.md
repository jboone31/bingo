# Draft Rules

The domain rules for leagues, the draft, and boards. These are the source of truth
for behavior. Specs refine them but should not contradict them. Items marked
**(assumption)** are working defaults that can be changed.

## Leagues And Membership

- Anyone signed in can create a league and becomes its admin.
- Others join through an invite link or join code and are regular players.
- A player can be in many leagues.
- Joining is allowed only before the draft starts. After the start, nobody can join.
- A league runs one draft.

## Submission Pool

- Only the admin adds, edits, removes, or recategorizes submissions, and only
  before the draft starts.
- Each submission has text, a submitter (free text set by the admin), and a category.
- The admin can bulk-load by CSV (columns: submission text, submitter, category) or
  add one at a time. A league can be created with an empty pool.
- Submitter names are visible to players **(assumption)**.

## Pre-Draft

- Every member can view the full pool, and filter and sort it by category.
- Every member keeps a personal queue: an ordered list of squares they want. They add
  from the pool and drag to re-rank.
- The admin sets a draft date. It is shown to all members.
- The admin sets the number of draft groups and can change it any time before the
  start.

## Starting The Draft

- The admin starts the draft after an explicit confirmation.
- **Start gate**: the pool must hold at least `ceil(N / G) x 25` submissions, where
  `N` is the number of members and `G` the number of groups. The admin screen shows
  this number as `G` changes. Example: 15 players in 1 group need 375; 15 players in
  3 groups need 125.
- On start, members are split at random into `G` groups whose sizes differ by at most
  one (each group has `floor(N / G)` or `ceil(N / G)` players).
- Each group receives its own full copy of the pool.

## The Draft

- All groups draft at the same time. Groups do not affect each other.
- Within a group, the draft is a **snake**: the order reverses each round. The
  starting order is random per group.
- A square can be drafted once per group. It stays available in other groups.
- There are **25 rounds**, one pick per player per round.
- Each pick has a time limit set by the admin per league, default 60 seconds
  **(assumption)**.
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
- Whether the random mapping is chosen once per league or once per group is undecided.
- Players view their card, export it as a PNG, and can export the full draft results
  as CSV. The CSV is for the admin's analysis.
