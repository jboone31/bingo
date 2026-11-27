# F8: Draft Room UI. Tasks
- [ ] 1. Pure logic (`lib/draftRoom/`)
  - [ ] 1.1 `types.ts`, `reduce.ts` (`applyEvents`) with property tests against the
        engine model. _R7.2, R7.3_
  - [ ] 1.2 `select.ts` (`turnState`, `availablePool`, `whereTaken`, `myPicks`,
        `groupGrid`, `latestInGroup`) with tests. _R2, R3, R6_
  - [ ] 1.3 `filter.ts` (`filterPool`) with property tests matching the pool page's
        rules. _R3.1_
  - [ ] 1.4 `alert.ts` (`titleFor`, `URGENT_MS`) with tests. _R2.4, R2.5_
- [ ] 2. Server
  - [ ] 2.1 `lib/draftRoom/snapshot.ts` (`readRoomSnapshot`, repeatable read, own
        queue only). _R7.1_
  - [ ] 2.2 `GET .../draft/state` with route tests. _R7.1_
  - [ ] 2.3 `test/integration/draftRoom.integration.test.ts`. _R7.1_
- [ ] 3. Realtime and countdown
  - [ ] 3.1 `baseSeq` for `stateFromInitial`, `EventFeed` and `useLeagueEvents`, with
        tests. _R7.2_
  - [ ] 3.2 `useCountdown` extracted from `Countdown` (keep the nudge fix), with tests.
        _R2.1, R7.4_
- [ ] 4. Components (`components/draftRoom/`)
  - [ ] 4.1 `useRoom` (snapshot plus events, `resync`). _R7_
  - [ ] 4.2 `DraftBanner` (states, pulse, title, vibrate, sound toggle, ticker). _R2_
  - [ ] 4.3 Shared component variants: `PoolFilterBar` local mode, `SubmissionList`
        `renderActions`, `QueueList` `rowAction`, `QueueToggle` `onChanged`. _R3, R4_
  - [ ] 4.4 `RoomPool`, `RoomQueue`, `DraftConfirm`, `RoomPicks`, `GroupGrid`,
        `DraftRoom`. _R3 to R6_
  - [ ] 4.5 Component tests (see design). _R2 to R7_
- [ ] 5. Pages and navigation
  - [ ] 5.1 `app/(app)/leagues/[leagueId]/draft/page.tsx` (members only, dark, not
        started and complete states). _R1_
  - [ ] 5.2 Draft tab in the league SubNav; overview link while drafting. _R1.3_
- [ ] 6. Dev scenario
  - [ ] 6.1 `draft_your_turn` (`settleAfterSeed`), scenario tests. _R8_
- [ ] 7. Steering and verification
  - [ ] 7.1 Update `conventions.md`, `structure.md`, the design-system note,
        `roadmap.md`.
  - [ ] 7.2 `npm run typecheck`, `lint`, `format:check`, `test`, `build`, and
        `npm run test:integration -- draftRoom draftEngine leagueEvents`.
  - [ ] 7.3 Manual (user): `draft_your_turn` on a laptop: the banner pulses, the title
        changes, and you draft from the queue after confirming. _R2, R5_
  - [ ] 7.4 Manual (user): on the phone: the sticky banner, tabs, vibration (Android),
        a pick from the pool. _R1.4, R2.4_
  - [ ] 7.5 Manual (user): two tabs as two players in one group; picks appear in both
        without a reload, and a square drafted by one leaves the other's pool and
        queue. _R3.3, R4.2, R7_
  - [ ] 7.6 Manual (user): reduced motion on: no pulsing, the your-turn state is still
        obvious. _R2.4_
  - [ ] 7.7 Manual (user): let your timer run out with the confirm dialog open. _R5.6_
  - [ ] 7.8 Manual (user): 360px and desktop width; finish a draft (bots on) and see
        the complete state. _R1_
