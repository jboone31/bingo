# F4: Pre-Draft Pool And Queue. Tasks

- [x] 1. Database
  - [x] 1.1 `supabase/migrations/0007_queue.sql`: unique constraint on submissions,
        `queue_items`, indexes, RLS, view, triggers, grants. Dry run, then
        `npm run db:migrate`. _R4, R5_
  - [x] 1.2 `test/integration/queue.integration.test.ts` (database parts). _R4, R5_

- [x] 2. Pure logic
  - [x] 2.1 `lib/pool/query.ts` (`parsePoolQuery`, `poolQueryToParams`, `searchPattern`,
        `describeFilter`) with example and fast-check tests. _R1_
  - [x] 2.2 `lib/queue/order.ts` with tests. _R3_
  - [x] 2.3 `lib/queue/rules.ts` with tests. _R2, R5_

- [x] 3. Server code and routes
  - [x] 3.1 `lib/queue/queries.ts`. _R4_
  - [x] 3.2 `POST` and `PUT .../queue`, `DELETE .../queue/[submissionId]`, with route
        tests. Add `queue_full` and `queue_changed` messages. _R2, R3, R4_
  - [x] 3.3 Integration tests for the query functions. _R4_

- [x] 4. Reads and filtering
  - [x] 4.1 Extend `lib/pool/read.ts` (`getPoolPage` with filters, `listCategories`).
        _R1_
  - [x] 4.2 `lib/queue/read.ts` (`getQueue`, `getQueuedIds`, `countQueue`). _R3_
  - [x] 4.3 Integration test: `pool_categories` visibility and the PostgREST embed and
        search behavior. _R1_

- [x] 5. UI
  - [x] 5.1 Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`; confirm
        they work with React 19. _R3_
  - [x] 5.2 `Pagination` `params` prop; `DraftDateLine`; `PoolFilterBar`. _R1, R6_
  - [x] 5.3 `QueueToggle` and the `SubmissionList` extension. _R2_
  - [x] 5.4 `QueueRow`, `QueueList` and the order saver, with tests. _R3_
  - [x] 5.5 Pool page filters, queue page, Queue nav item, overview queue count.
        _R1, R3, R6_
  - [x] 5.6 Page smoke tests. _R1, R3_

- [x] 6. Dev scenario
  - [x] 6.1 `viewerQueueSize`, `fakeQueueSize`, `seedQueueOrder`, `queue_started`;
        extend `seedScenario` and the scenario tests. _R8_

- [ ] 7. Manual check
  - [ ] 7.1 Run `queue_started`. Filter by category (try mixed-case duplicates), search
        with `%`, `_` and quotes, sort each way, page through a filtered list.
  - [ ] 7.2 Add and remove from the pool; confirm the button flips at once.
  - [ ] 7.3 On the queue page, drag by the handle on a laptop and on a phone (the page
        must still scroll), use the Move buttons, and reorder with the keyboard.
  - [ ] 7.4 Open the queue in two tabs and reorder in one; confirm the other reports
        the change instead of overwriting it.
  - [ ] 7.5 Check 360px and desktop width.

- [x] 8. Done checks
  - [x] 8.1 Update `structure.md`, `tech.md`, `conventions.md`, `roadmap.md`.
  - [x] 8.2 `npm run typecheck`, `lint`, `format:check`, `test`, `build`, and
        `test:integration`.
