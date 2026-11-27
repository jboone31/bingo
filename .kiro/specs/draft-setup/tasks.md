# F6: Draft Setup And Start. Tasks
- [x] 1. Database
  - [x] 1.1 `supabase/migrations/0010_draft_setup.sql`: league columns, settings guard,
        `draft_groups`, `draft_group_members`, guards, RLS, grants. Dry run, then
        `npm run db:migrate`. _R1.3, R3.5, R4_
  - [x] 1.2 `test/integration/draftSetup.integration.test.ts` (database parts). _R1.3,
        R4_
- [x] 2. Pure logic
  - [x] 2.1 `lib/draft/settings.ts` and `gate.ts` with example and fast-check tests.
        _R1, R2_
  - [x] 2.2 `lib/draft/split.ts` with property tests. _R3.5_
  - [x] 2.3 `lib/draft/rules.ts` with tests. _R1.3, R3.2 to R3.4_
  - [x] 2.4 Event builders and text (`draft_settings_changed`, `draft_started`). _R1.4,
        R3.6_
- [x] 3. Server code and routes
  - [x] 3.1 Extend `LeagueRow`; `lib/draft/queries.ts` and `start.ts`. _R3_
  - [x] 3.2 `PATCH .../draft-settings` with route tests and messages. _R1_
  - [x] 3.3 `POST .../start` with route tests and messages. _R3_
  - [x] 3.4 Integration tests for `startDraft` (split, repeat, event, race with a
        join). _R3_
- [x] 4. Reads and UI
  - [x] 4.1 `lib/draft/read.ts`; extend `getLeague` with the new columns. _R2, R4_
  - [x] 4.2 `components/draft/` (DraftSetupPanel with form, gate and start button;
        GateSummary; DraftGroups) with component tests. _R1, R2, R3.1, R4.3_
  - [x] 4.3 Settings page and overview wiring. _R2.6, R4.3_
- [x] 5. Dev scenarios
  - [x] 5.1 Plan fields, the three new scenarios, seeding through `startDraft`,
        scenario tests. _R5_
- [ ] 6. Steering and verification
  - [x] 6.1 Update `draft-rules.md`, `product.md`, `structure.md`, `roadmap.md`.
  - [x] 6.2 `npm run typecheck`, `lint`, `format:check`, `test`, `build`, and
        `npm run test:integration -- draftSetup` plus the suites touched.
  - [ ] 6.3 Manual (user): on `ready_three_groups`, change groups and timer, watch the
        gate, save, start, and check the groups on the overview. _R1 to R4_
  - [ ] 6.4 Manual (user): on `pool_short`, Start is disabled with the reason. _R2.5_
  - [ ] 6.5 Manual (user): after the start, a seed player (act as) cannot leave
        (queue edits are allowed again since F7), a new player cannot join with the code, and the admin cannot
        edit the pool, settings or draft date. _R3.7_
  - [ ] 6.6 Manual (user): settings and overview at 360px and desktop width.
