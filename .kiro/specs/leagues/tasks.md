# F2: Leagues. Tasks

- [ ] 1. Shared API helpers
  - [ ] 1.1 `lib/api/` (`response`, `errors`, `body`, `ids`, `handler`) with tests.
        _R8.1, R8.2_
  - [ ] 1.2 Move `PATCH /api/profile` onto `handle`; its existing tests still pass.
        _R8.3_

- [ ] 2. Database
  - [ ] 2.1 `supabase/migrations/0004_leagues.sql`: tables, indexes, triggers, helper
        functions, policies, grants, and the widened `profiles` policy. _R7.4, R7.5_
  - [ ] 2.2 Dry run, then `npm run db:migrate`.
  - [ ] 2.3 Shared integration helpers in `test/integration/helpers/`; switch the
        profiles test to them.
  - [ ] 2.4 `test/integration/leagues.integration.test.ts` as listed in the design.
        _R7_

- [ ] 3. Pure logic (`lib/leagues/`)
  - [ ] 3.1 `joinCode.ts` with example and fast-check tests. _R2.3_
  - [ ] 3.2 `name.ts` and `draftAt.ts` with tests. _R1.2, R1.3_
  - [ ] 3.3 `rules.ts` with example tables and properties. _R2, R5, R6_

- [ ] 4. Data access and routes
  - [ ] 4.1 `lib/leagues/queries.ts` (locks, code generation with retry, member and
        league writes). _R7.2_
  - [ ] 4.2 `POST /api/leagues` (create, idempotent by `requestId`). _R1_
  - [ ] 4.3 `POST /api/leagues/join`. _R2_
  - [ ] 4.4 `POST /api/leagues/[leagueId]/leave` and
        `DELETE .../members/[userId]`. _R5_
  - [ ] 4.5 `POST .../join-code`, `POST .../transfer`, `DELETE /api/leagues/[leagueId]`.
        _R6_
  - [ ] 4.6 Route tests for every route as listed in the design. _R7_

- [ ] 5. Reads and pages
  - [ ] 5.1 `lib/leagues/read.ts` (`listMyLeagues`, `getLeague`, `listMembers`). _R3, R4_
  - [ ] 5.2 `components/leagues/`: `LeagueCard`, `ConfirmAction`, `InvitePanel`,
        `MemberList`, `DeleteLeagueDialog`, `TransferAdminForm`, with tests.
  - [ ] 5.3 `CreateLeagueForm` and `/leagues/new`. _R1_
  - [ ] 5.4 `JoinLeagueForm`, `/leagues/join` and `/join/[code]`. _R2_
  - [ ] 5.5 Home list in `app/(app)/page.tsx` with empty state. _R3_
  - [ ] 5.6 League layout (404 for non-members, `SubNav`), overview page, settings
        page (admin only). _R4, R6_
  - [ ] 5.7 Page smoke tests for home and the invite link page.

- [ ] 6. Manual check
  - [ ] 6.1 With two Google accounts: create a league, join by code and by link,
        confirm the member list shows both names, leave and rejoin, remove, transfer
        admin, regenerate the code (old code fails), delete the league.
  - [ ] 6.2 Check the pages at 360px and desktop width.

- [ ] 7. Done checks
  - [ ] 7.1 Update `structure.md` and `conventions.md` as listed in the design; add
        removal to `draft-rules.md`.
  - [ ] 7.2 Set F2 to Done in `roadmap.md`. Record the dev scenarios from the
        appendix under F2.5 in the roadmap.
  - [ ] 7.3 `npm run typecheck`, `lint`, `format:check`, `test`, `build`, and
        `test:integration` all pass. The dev scenarios are built in F2.5, not here.
