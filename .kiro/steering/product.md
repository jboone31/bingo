# Product

## What is the Bingo Draft?

An annual bingo game played as a draft. A group of friends submits squares (short
predictions or events that might happen over the coming year). Players then draft
those squares in snake order, and each player ends up with a unique 5x5 bingo board
built from the squares they drafted. The year plays out, and boards are marked off.

This project builds the web app that runs the pre-draft, the live draft, and board
generation.

## Roles

- **Player**: any signed-in user. Can belong to many leagues at once.
- **League admin**: the player who created a league. Admin is the default for the
  creator; everyone who joins later is a regular player. (Admin transfer is not
  decided yet.)

## Core Concepts

- **League**: one annual draft with its own members, submission pool, draft date and
  settings. Anyone can create a league or join one by invite link or join code.
- **Submission pool**: the squares available to draft. Only the admin adds them, by
  CSV upload (submission text, submitter, category) or one at a time. Each
  submission has a free-text submitter name set by the admin.
- **Draft group**: a league's members are split into N groups. Each group drafts at
  the same time from its own copy of the pool, so the same square can be drafted once
  per group.
- **Queue**: a player's personal ranked list of squares they want. It drives
  auto-picks and is editable before and during the draft.
- **Board**: a 5x5 card generated for each player after every group finishes.

## Lifecycle

1. **Pre-draft**: players join, browse and filter the pool, and build their queue.
   The admin builds the pool, sets the draft date and group count, and starts the
   draft once the pool is large enough. Nobody can join after the start.
2. **Draft**: groups draft simultaneously on a per-turn clock. A live feed shows
   what is happening, including a full-screen view for a shared display.
3. **Boards**: once all groups are done, boards are generated. Players view their
   card and export it as an image. Full draft results export as CSV.

## Experience Goals

- Works well on a phone and on a big screen.
- The draft feels live: picks, timers and feeds update without refreshing.
- A draft finishes even if players wander off. The clock always runs and
  auto-picks keep it moving.
- Minimal friction to join: sign in with Google, open a link or enter a code.

## Out of Scope For Now

- Players submitting their own squares.
- Marking squares as they happen during the year.
- Admin tools beyond pool management, draft date, group count and starting the draft.

## Open Product Questions

- Does the admin also play in their own league?
- Can admin rights transfer, and can a league be deleted?
- Does the draft date do anything beyond being displayed?
- Should submitter names be hidden from players until the draft ends?

---

_This file describes direction. Detailed behavior lives in each feature's spec. See
`roadmap.md` for the feature list and `draft-rules.md` for the draft and board rules._
