# F3: Pool Administration. Tasks

- [ ] 1. Database
  - [ ] 1.1 `supabase/migrations/0006_submissions.sql`: tables, index, triggers,
        RLS, grants. Dry run, then `npm run db:migrate`. _R5.3_
  - [ ] 1.2 `test/integration/pool.integration.test.ts`. _R5_

- [ ] 2. Pure logic (`lib/pool/`)
  - [ ] 2.1 `limits.ts` and `fields.ts` with example and fast-check tests. _R1.2_
  - [ ] 2.2 `csv.ts` (`parseCsv`, `serializeCsv`) with a round-trip property. _R2.3_
  - [ ] 2.3 `importCsv.ts` with tests. _R2.2, R2.4, R2.5, R2.9_
  - [ ] 2.4 `rules.ts` with tests. _R3.4, R5, R2.7_

- [ ] 3. Data access and routes
  - [ ] 3.1 `lib/pool/queries.ts`. _R5.1_
  - [ ] 3.2 `POST .../submissions` (add, idempotent). _R1_
  - [ ] 3.3 `POST .../submissions/import` (dry run and import). _R2_
  - [ ] 3.4 `PATCH` and `DELETE .../submissions/[submissionId]`, and
        `DELETE .../submissions` (clear). _R3_
  - [ ] 3.5 Route tests for every route. _R5_

- [ ] 4. Reads and pages
  - [ ] 4.1 `lib/pool/read.ts` and `lib/pool/messages.ts`. _R4_
  - [ ] 4.2 `components/ui/Pagination` with a test. _R4.2_
  - [ ] 4.3 `components/pool/`: `SubmissionList`, `SubmissionActions`,
        `AddSubmissionForm`, `ImportCsvPanel`, `ClearPoolButton`, with tests. _R1 to R3_
  - [ ] 4.4 Pool page, Pool item in `SubNav`, pool size on the overview. _R4_
  - [ ] 4.5 Page smoke tests.

- [ ] 5. Dev scenarios
  - [ ] 5.1 Add `poolSubmissions` to `ScenarioPlan`; add `league_with_pool` and
        `pool_ready`; extend `seedScenario` and the scenario tests. _R6_

- [ ] 6. Manual check
  - [ ] 6.1 Run `league_with_pool`: page through the pool, edit and delete a row, add a
        duplicate, upload a good CSV, upload a CSV with bad rows and read the errors,
        double-click Import, clear the pool.
  - [ ] 6.2 Check at 360px and desktop width, and as a regular member (read only).

- [ ] 7. Done checks
  - [ ] 7.1 Update `structure.md`, `draft-rules.md`, `conventions.md`, `roadmap.md`.
  - [ ] 7.2 `npm run typecheck`, `lint`, `format:check`, `test`, `build`, and
        `test:integration` (excluding the service-role suites unless you run them).
