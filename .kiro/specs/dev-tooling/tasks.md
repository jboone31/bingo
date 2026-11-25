# F2.5: Dev Tooling and Seed Scenarios. Tasks

- [ ] 1. Safety gate
  - [ ] 1.1 Update `isDevToolsEnabled` to also require `VERCEL_ENV !== "production"`;
        extend its tests. _R1.1, R1.2_
  - [ ] 1.2 `lib/dev/gate.ts` (`assertDevTools`); move the component gallery onto the
        shared gate. _R1.2_
  - [ ] 1.3 Update `.env.example` warnings. _R1.5_

- [ ] 2. Database
  - [ ] 2.1 `supabase/migrations/0005_seed_tag.sql`. Dry run, then
        `npm run db:migrate`. _R3.1_

- [ ] 3. Pure logic
  - [ ] 3.1 `lib/dev/seedIdentity.ts` with example and fast-check tests. _R2_
  - [ ] 3.2 `lib/dev/scenarios.ts` (registry, `planFor`) with tests. _R3_

- [ ] 4. Server code
  - [ ] 4.1 `lib/dev/seedUsers.ts`: `ensureSeedUsers`, `listSeedUsers`,
        `deleteAllSeedUsers`. _R2_
  - [ ] 4.2 `lib/dev/seedScenario.ts`. _R3_
  - [ ] 4.3 `lib/dev/reset.ts`. _R4_
  - [ ] 4.4 `lib/dev/actAs.ts`. _R5_
  - [ ] 4.5 Routes `POST /api/dev/seed`, `/reset`, `/act-as` with tests. _R1, R3,
        R4, R5_
  - [ ] 4.6 `test/integration/devTools.integration.test.ts`. _R2 to R5_

- [ ] 5. UI
  - [ ] 5.1 `components/dev/DevTools.tsx` and `app/(app)/dev/page.tsx`, with tests.
        _R6_
  - [ ] 5.2 `DevBanner`, `AppHeader` prop, and the layout wiring, with tests. _R5.3_

- [ ] 6. Manual check
  - [ ] 6.1 With `ENABLE_DEV_TOOLS=1`: run each scenario, open the league, check the
        member counts and roles; act as a fake player and check the banner and their
        view; reset mine, then reset all.
  - [ ] 6.2 Confirm `/dev` returns 404 with the flag unset.

- [ ] 7. Done checks
  - [ ] 7.1 Update `conventions.md`, `structure.md` and `roadmap.md` as listed in the
        design.
  - [ ] 7.2 `npm run typecheck`, `lint`, `format:check`, `test`, `build` and
        `test:integration` pass.
