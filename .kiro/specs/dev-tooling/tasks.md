# F2.5: Dev Tooling and Seed Scenarios. Tasks

- [x] 1. Safety gate
  - [x] 1.1 Update `isDevToolsEnabled` to also require `VERCEL_ENV !== "production"`;
        extend its tests. _R1.1, R1.2_
  - [x] 1.2 `lib/dev/gate.ts` (`assertDevTools`); move the component gallery onto the
        shared gate. _R1.2_
  - [x] 1.3 Update `.env.example` warnings. _R1.5_

- [x] 2. Database
  - [x] 2.1 `supabase/migrations/0005_seed_tag.sql`. Dry run, then
        `npm run db:migrate`. _R3.1_

- [x] 3. Pure logic
  - [x] 3.1 `lib/dev/seedIdentity.ts` with example and fast-check tests. _R2_
  - [x] 3.2 `lib/dev/scenarios.ts` (registry, `planFor`) with tests. _R3_

- [x] 4. Server code
  - [x] 4.1 `lib/dev/seedUsers.ts`: `ensureSeedUsers`, `listSeedUsers`,
        `deleteAllSeedUsers`. _R2_
  - [x] 4.2 `lib/dev/seedScenario.ts`. _R3_
  - [x] 4.3 `lib/dev/reset.ts`. _R4_
  - [x] 4.4 `lib/dev/actAs.ts`. _R5_
  - [x] 4.5 Routes `POST /api/dev/seed`, `/reset`, `/act-as` with tests. _R1, R3,
        R4, R5_
  - [x] 4.6 `test/integration/devTools.integration.test.ts`. _R2 to R5_

- [x] 5. UI
  - [x] 5.1 `components/dev/DevTools.tsx` and `app/(app)/dev/page.tsx`, with tests.
        _R6_
  - [x] 5.2 `DevBanner`, `AppHeader` prop, and the layout wiring, with tests. _R5.3_

- [ ] 6. Manual check
  - [x] 6.1 With `ENABLE_DEV_TOOLS=1`: run each scenario, open the league, check the
        member counts and roles; act as a fake player and check the banner and their
        view; reset mine, then reset all.
  - [ ] 6.2 Confirm `/dev` returns 404 with the flag unset.

- [x] 7. Done checks
  - [x] 7.1 Update `conventions.md`, `structure.md` and `roadmap.md` as listed in the
        design.
  - [x] 7.2 `npm run typecheck`, `lint`, `format:check`, `test`, `build` and
        `test:integration` pass.
