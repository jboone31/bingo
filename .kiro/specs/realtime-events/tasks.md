# F5: Realtime And Event Log. Tasks
- [ ] 1. Database
  - [ ] 1.1 `supabase/migrations/0008_league_events.sql`: `leagues.last_event_seq`,
        `league_events`, RLS, grants, immutability trigger, `append_league_event`,
        Realtime publication. Dry run, then `npm run db:migrate`. _R1, R2_
  - [ ] 1.2 `test/integration/leagueEvents.integration.test.ts` (see design). _R1, R2_
- [ ] 2. Pure logic
  - [ ] 2.1 `lib/events/types.ts`, `payload.ts`, `describe.ts` with tests. _R1, R5_
  - [ ] 2.2 `lib/events/fold.ts` and `catchUp.ts` with example and fast-check tests.
        _R3_
  - [ ] 2.3 `lib/time/clockOffset.ts` with tests. _R4_
- [ ] 3. Server code and routes
  - [ ] 3.1 `lib/events/append.ts` and `read.ts`. _R1, R5_
  - [ ] 3.2 Expose "changed" from query functions where needed (join, leave, remove,
        transfer, draft date, submissions add, edit, delete, clear, import), updating
        their tests. _R1.3_
  - [ ] 3.3 Append events in the eleven mutation points, with route tests for event
        and no-event cases. _R1_
  - [ ] 3.4 `GET /api/time` with a route test. _R4_
- [ ] 4. Client
  - [ ] 4.1 `components/realtime/useLeagueEvents.ts` with component tests (mocked
        client). _R3_
  - [ ] 4.2 `components/realtime/ServerClockProvider.tsx`, mounted in the signed-in
        layout, with a test. _R4_
  - [ ] 4.3 `components/leagues/ActivityFeed.tsx` and the overview page wiring, with
        tests. _R5_
- [ ] 5. Dev tooling
  - [ ] 5.1 `eventCount` in `ScenarioPlan`, `league_with_activity`, seeding in
        `seedScenario`, scenario tests. _R6_
- [ ] 6. Steering and verification
  - [ ] 6.1 Add an Events rule to `conventions.md` (every league mutation appends an
        event in its transaction), update `structure.md` (`lib/events/`, `lib/time/`,
        `components/realtime/`, migration 0008, `/api/time`) and `roadmap.md`.
  - [ ] 6.2 `npm run typecheck`, `lint`, `format:check`, `test`, `build`, and
        `npm run test:integration -- leagueEvents`.
  - [ ] 6.3 Manual (user): open the `league_with_activity` overview and confirm 50
        events newest first. _R5, R6_
  - [ ] 6.4 Manual (user): two tabs, act as a seed player in one and join, change the
        draft date and import a CSV; the other tab updates without a reload. _R3, R5_
  - [ ] 6.5 Manual (user): go offline in dev tools for a few seconds, make a change in
        the other tab, go online; the missed events appear. _R3_
  - [ ] 6.6 Manual (user): overview at 360px and desktop width. _R5_
