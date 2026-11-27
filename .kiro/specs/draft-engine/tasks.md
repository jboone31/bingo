# F7: Draft Engine And Timers. Tasks
- [ ] 1. Pure model
  - [ ] 1.1 `lib/draft/engine.ts` (`onClock`, `totalPicks`, `nextDeadline`,
        `autoChoice`, `settle`) with example and fast-check tests. _R1, R3_
- [ ] 2. Database
  - [ ] 2.1 Check the pg_cron version supports seconds schedules.
  - [ ] 2.2 `supabase/migrations/0011_draft_engine.sql`: columns, `draft_clocks`,
        `draft_picks`, guards (picks immutable, membership delete, queue guard), RLS,
        grants, engine functions, backfill, cron job. Dry run, then
        `npm run db:migrate`. _R1 to R6, R8_
  - [ ] 2.3 `test/integration/draftEngine.integration.test.ts`: snake parity, picks,
        settle, cascade, concurrency, completion, bots, cron sweep, guards, RLS. _R1 to
        R6_
- [ ] 3. Server code and routes
  - [ ] 3.1 `lib/draft/engine.server.ts` and the error mapping; `startDraft` creates
        clocks. _R1, R2, R3_
  - [ ] 3.2 `POST .../draft/pick` and `POST .../draft/settle` with route tests and
        messages. _R2, R3.5_
  - [ ] 3.3 Queue rules and routes in `drafting`: settle first, `square_taken`, refuse
        in `in_progress`; update tests that expected 409. _R3.7, R4_
  - [ ] 3.4 Event builders and text (`pick_made`, `group_finished`,
        `draft_completed`). _R2.5, R5_
  - [ ] 3.5 `POST /api/dev/draft` with route tests. _R8_
- [ ] 4. Reads and UI
  - [ ] 4.1 `getDraftStatus` in `lib/draft/read.ts`. _R7_
  - [ ] 4.2 `Countdown`, `DraftStatus`, `DevDraftPanel` with component tests; overview
        wiring. _R7, R8_
- [ ] 5. Dev scenarios
  - [ ] 5.1 Plan fields, `draft_mid`, `draft_expired`, `draft_last_round`, seeding,
        scenario tests. _R9_
- [ ] 6. Steering and verification
  - [ ] 6.1 Update `conventions.md`, `tech.md`, `draft-rules.md`, `structure.md`,
        `roadmap.md`.
  - [ ] 6.2 `npm run typecheck`, `lint`, `format:check`, `test`, `build`, and the
        integration suites touched (`draftEngine draftSetup devReset queue
        leagueEvents leagues`).
  - [ ] 6.3 Manual (user): `draft_mid` with bots; your turn counts down and auto-picks
        at zero. _R3, R7, R8_
  - [ ] 6.4 Manual (user): `draft_expired` with no tab open; reopen after 10 seconds
        and see one auto-pick per group. _R3.6_
  - [ ] 6.5 Manual (user): `draft_last_round`, bots on, expire your turn; the league
        reaches complete. _R5_
  - [ ] 6.6 Manual (user): queue edits during the draft; a picked square disappears
        from queues in that group. _R4_
  - [ ] 6.7 Manual (user): Draft status panel at 360px and desktop width. _R7_
