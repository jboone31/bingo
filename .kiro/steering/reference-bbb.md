---
inclusion: auto
name: reference-bbb
description: Reference for the sibling Beltline Bar Brawl (BBB) project's timer, settle, realtime and event-log patterns. Use when designing or building the draft timer, auto-pick, the event log, Realtime subscriptions, reconnect and catch-up, or the server clock offset.
---

# Reference: Beltline Bar Brawl (BBB)

BBB is an earlier project by the same author that solved the same class of problem
(server-authoritative timers, live updates, an append-only event log) on the same
stack. Use it as a reference. Do not copy blindly: the bingo draft's events and rules
differ.

Location: `/Users/hadenboone/Documents/Authored Games/BBB` (sibling folder). If it is
not readable, the pattern summary below is enough to start.

## The Timer Pattern In Brief

1. **Deadlines are data.** A row stores when something starts and ends, plus an
   "announced" timestamp that is null until the transition has been handled.
2. **One idempotent settle function** locks the game row, finds due transitions, and
   claims each with a conditional update (`... where announced_at is null returning
   id`). It appends an event only when its own update claimed the row. Two callers
   can never both fire the same transition, and a unique index backs this up.
3. **Many callers trigger the settle**, so no single scheduler is required:
   connected clients nudge it after a known boundary, every mutation settles first
   inside its own transaction, and an optional cron route sweeps all live games with
   `skip locked`.
4. **Clients render against server time.** A nudge response carries the server's
   clock. The client estimates its offset from the round-trip midpoint and shows
   countdowns in server time.

## What The Draft Changes

- Nudge timing is tight: about 0 to 1 second after a deadline, not BBB's 3 to 5.
- A seconds-level `pg_cron` job is a required backstop. BBB tolerates no guarantee
  when nobody is connected; the draft does not.
- The settle must loop until the current turn is unexpired, because several turns can
  expire while nobody is connected.
- Auto-pick and its event commit in one transaction.

## Files Worth Reading

| Topic | File (under BBB) |
| --- | --- |
| Idempotent settle function and why it is built that way | `supabase/migrations/0014_card_effect_sweep.sql` |
| `pg_cron` scheduling guarded for availability | `supabase/migrations/0007_auto_timeout_sweep.sql` |
| Client timers, nudge jitter, coalescing | `lib/cards/boardTimers.ts` |
| Clock offset estimate | `lib/cards/clockOffset.ts` |
| Member-driven nudge route | `app/api/games/[gameId]/effects/settle/route.ts` |
| Secret-protected cron route with constant-time compare | `app/api/cron/card-effects/route.ts` |
| Subscribe, reconnect, resume, missed-event catch-up | `lib/realtime/` |
| Append-only event log helpers | `lib/events/` |
| Hosting and realtime decision record | `docs/decisions/0001-hosting-and-stack.md` |

## Already Ported

`scripts/apply-migrations.mjs`, `scripts/check-db.mjs` and `lib/db/server.ts` were
adapted from BBB in the foundation. The realtime and timer code is deliberately
written fresh for this project.
