# F1: Auth and Profiles. Tasks

- [ ] 1. Database
  - [ ] 1.1 Write `supabase/migrations/0002_profiles.sql` (table, RLS, select
        policy, trigger function, trigger, backfill). _R2, R6_
  - [ ] 1.2 Run `npm run db:migrate -- --dry-run`, then `npm run db:migrate`. _R2_
  - [ ] 1.3 Integration tests in `test/integration/profiles.test.ts`. _R2, R6_

- [ ] 2. Pure logic (`lib/`)
  - [ ] 2.1 `lib/auth/redirect.ts` with example and fast-check tests. _R1.4_
  - [ ] 2.2 `lib/auth/access.ts` with example and fast-check tests. _R4_
  - [ ] 2.3 `lib/profile/displayName.ts` with example and fast-check tests. _R3.2_

- [ ] 3. Server integration
  - [ ] 3.1 `lib/auth/session.ts` (`getSessionUser`, server-only). _R4.5_
  - [ ] 3.2 Extend `utils/supabase/middleware.ts` to call `getClaims()`, apply
        `decideAccess`, and carry refreshed cookies on every response. Update the
        doc comment that says refresh arrives with F1. _R4_
  - [ ] 3.3 `app/api/auth/callback/route.ts` with tests. _R1_
  - [ ] 3.4 `app/api/auth/sign-out/route.ts` (POST) with tests. _R5_
  - [ ] 3.5 `lib/profile/updateProfile.ts` and `app/api/profile/route.ts` (PATCH)
        with tests. _R3, R6.4, R6.5_

- [ ] 4. UI
  - [ ] 4.1 `app/sign-in/page.tsx` and the Google button client component; show
        mapped error text; redirect when already signed in. _R1_
  - [ ] 4.2 Create `components/` with `SignOutButton` and `DisplayNameForm`. _R3, R5_
  - [ ] 4.3 `app/profile/page.tsx` reading the profile through the RLS-scoped server
        client. _R3.1_
  - [ ] 4.4 Update `app/page.tsx` to show the display name, a profile link and sign
        out. Update `app/page.smoke.test.tsx`. _R5.1_

- [ ] 5. Manual setup
  - [ ] 5.1 Enable Google in Supabase Auth and add redirect URLs for local, preview
        and production. _R1_
  - [ ] 5.2 Sign in end to end locally; confirm the profile row, edit the name, sign
        out. _R1 to R5_

- [ ] 6. Done checks
  - [ ] 6.1 Add `components/` to the layout block in `.kiro/steering/structure.md`
        and list `auth/` and `profile/` under `lib/`. Update `README.md` if it
        covers setup.
  - [ ] 6.2 Set F1 to Done in `.kiro/steering/roadmap.md`; record the display-name
        decision in `.kiro/steering/product.md` (Identity).
  - [ ] 6.3 `npm run typecheck`, `lint`, `format:check`, `test`, `build`, and
        `test:integration` all pass.
