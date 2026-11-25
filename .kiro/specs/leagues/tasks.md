# F2: Leagues. Tasks

- [x] 1. Shared API helpers
  - [x] 1.1 `lib/api/` (`response`, `errors`, `body`, `ids`, `handler`) with tests.
        _R8.1, R8.2_
  - [x] 1.2 Move `PATCH /api/profile` onto `handle`; its existing tests still pass.
        _R8.3_

- [x] 2. Database
  - [x] 2.1 `supabase/migrations/0004_leagues.sql`: tables, indexes, triggers, helper
        functions, policies, grants, and the widened `profiles` policy. _R7.4, R7.5_
  - [x] 2.2 Dry run, then `npm run db:migrate`.
  - [x] 2.3 Shared integration helpers in `test/integration/helpers/`; switch the
        profiles test to them.
  - [x] 2.4 `test/integration/leagues.integration.test.ts` as listed in the design.
        _R7_

- [x] 3. Pure logic (`lib/leagues/`)
  - [x] 3.1 `joinCode.ts` with example and fast-check tests. _R2.3_
  - [x] 3.2 `name.ts` and `draftAt.ts` with tests. _R1.2, R1.3_
  - [x] 3.3 `rules.ts` with example tables and properties. _R2, R5, R6_

- [x] 4. Data access and routes
  - [x] 4.1 `lib/leagues/queries.ts` (locks, code generation with retry, member and
        league writes). _R7.2_
  - [x] 4.2 `POST /api/leagues` (create, idempotent by `requestId`). _R1_
  - [x] 4.3 `POST /api/leagues/join`. _R2_
  - [x] 4.4 `POST /api/leagues/[leagueId]/leave` and
        `DELETE .../members/[userId]`. _R5_
  - [x] 4.5 `POST .../join-code`, `POST .../transfer`, `DELETE /api/leagues/[leagueId]`.
        _R6_
  - [x] 4.6 Route tests for every route as listed in the design. _R7_

- [x] 5. Reads and pages
  - [x] 5.1 `lib/leagues/read.ts` (`listMyLeagues`, `getLeague`, `listMembers`). _R3, R4_
  - [x] 5.2 `components/leagues/`: `LeagueCard`, `ConfirmAction`, `InvitePanel`,
        `MemberList`, `DeleteLeagueDialog`, `TransferAdminForm`, with tests.
  - [x] 5.3 `CreateLeagueForm` and `/leagues/new`. _R1_
  - [x] 5.4 `JoinLeagueForm`, `/leagues/join` and `/join/[code]`. _R2_
  - [x] 5.5 Home list in `app/(app)/page.tsx` with empty state. _R3_
  - [x] 5.6 League layout (404 for non-members, `SubNav`), overview page, settings
        page (admin only). _R4, R6_
  - [x] 5.7 Page smoke tests for home and the invite link page.

- [ ] 6. Manual check
  - [x] 6.1 With two Google accounts: create a league, join by code and by link,
        confirm the member list shows both names, leave and rejoin, remove, transfer
        admin, regenerate the code (old code fails), delete the league.
  - [ ] 6.2 Check the pages at 360px and desktop width.

- [x] 7. Done checks
  - [x] 7.1 Update `structure.md` and `conventions.md` as listed in the design; add
        removal to `draft-rules.md`.
  - [x] 7.2 Set F2 to Done in `roadmap.md`. Record the dev scenarios from the
        appendix under F2.5 in the roadmap.
  - [x] 7.3 `npm run typecheck`, `lint`, `format:check`, `test`, `build`, and
        `test:integration` all pass. The dev scenarios are built in F2.5, not here.
