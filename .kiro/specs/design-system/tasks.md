# F1.5: Design System and App Shell. Tasks

- [ ] 1. Tokens and fonts
  - [ ] 1.1 Write `app/tokens.css` with the color, type, spacing, radius, shadow and
        motion tokens, dark default, light via `prefers-color-scheme`, and the
        `data-theme="dark"` override. _R1_
  - [ ] 1.2 Load Barlow Condensed and Inter with `next/font/google` in
        `app/layout.tsx`; expose `--font-display` and `--font-body`; set base body
        styles in `globals.css`. _R1_
  - [ ] 1.3 Tests: token contrast pairs and the no-hard-coded-colors scan. _R1.3,
        R1.5_

- [ ] 2. Shared components (`components/ui/`)
  - [ ] 2.1 Button and ButtonLink. _R2_
  - [ ] 2.2 TextField, Panel, Badge, PageHeader. _R2_
  - [ ] 2.3 Dialog. _R2.3_
  - [ ] 2.4 ToastProvider and `useToast`, mounted in `app/layout.tsx`. _R2.4_
  - [ ] 2.5 EmptyState, ErrorState, Spinner, Skeleton. _R2_
  - [ ] 2.6 A jsdom test per component. _R2.6_

- [ ] 3. Date and time
  - [ ] 3.1 `lib/format/dateTime.ts` with example and fast-check tests. _R7.1,
        R7.3, R7.4_
  - [ ] 3.2 `components/LocalTime.tsx` and its test. _R7.2_

- [ ] 4. App shell
  - [ ] 4.1 Create the `(app)` route group; move `app/page.tsx` and
        `app/profile/` into it; keep URLs unchanged. _R3.5_
  - [ ] 4.2 `components/shell/`: AppHeader, UserMenu, PageContainer, SubNav, with
        tests. _R3.1, R3.2, R3.3_
  - [ ] 4.3 `app/(app)/layout.tsx` reading the session and display name. _R3_
  - [ ] 4.4 `app/not-found.tsx` and `app/error.tsx`. _R3.6_
  - [ ] 4.5 Give `app/sign-in/` its own full-bleed layout. _R3.4_

- [ ] 5. Restyle F1 screens
  - [ ] 5.1 Sign-in, Profile and Home use the shared components. Update the
        existing tests; behavior is unchanged. _R9_
  - [ ] 5.2 Replace the inline field in `DisplayNameForm` with `TextField`, and use
        toasts for save results. _R9_

- [ ] 6. Gallery and dev flag
  - [ ] 6.1 `isDevToolsEnabled` in `lib/env` with a test; document
        `ENABLE_DEV_TOOLS` in `.env.example`. _R8.2, R8.3_
  - [ ] 6.2 `app/(app)/dev/components/page.tsx` with the dark-mode toggle and a
        not-found test. _R8_

- [ ] 7. Manual check
  - [ ] 7.1 With `ENABLE_DEV_TOOLS=1`, review the gallery in light and dark, at
        360px and desktop width, keyboard only, and with reduced motion on. Adjust
        tokens as needed. _R1, R2_
  - [ ] 7.2 Confirm sign-in, profile edit and sign out still work end to end. _R9_

- [ ] 8. Done checks
  - [ ] 8.1 Update `structure.md` (layout block gains nothing new at top level;
        document `components/ui`, `components/shell`, `(app)`, `tokens.css`,
        `lib/format`, the URL scheme) and add the Design rule to `conventions.md`.
        _Structure Updates_
  - [ ] 8.2 Set F1.5 to Done in `roadmap.md`.
  - [ ] 8.3 `npm run typecheck`, `lint`, `format:check`, `test` and `build` pass.
        No new database tables, so no new integration tests.
