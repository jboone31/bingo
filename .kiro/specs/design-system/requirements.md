# F1.5: Design System and App Shell. Requirements

Depends on F1. Rules referenced: `product.md` (Experience Goals), `conventions.md`
(Code Layout, Dev Scenarios), `structure.md`.

## Decisions Recorded

- **CSS approach**: CSS Modules plus CSS custom properties for tokens. No CSS
  framework and no component library.
- **Visual style**: sports-draft broadcast. Dark, high contrast, bold condensed
  display type, big numerals, scoreboard-style panels, one strong accent color.
  Immersive on the draft room and big screen.
- **Color scheme**: follows the system setting (light or dark) for the whole app.
  The big screen and draft room can force dark. Both schemes are defined once, as
  tokens.
- **Times**: stored as `timestamptz`, shown in each viewer's own time zone.

## User Stories And Acceptance Criteria

### R1. Design tokens

As a developer, I style everything from one set of tokens so screens stay consistent.

1. One tokens file defines color, type, spacing, radius, shadow, motion and
   breakpoint values as CSS custom properties.
2. Colors are defined for light and dark. Dark is the default look. Light applies
   when the system prefers light, unless a page forces dark.
3. Text and control colors meet WCAG AA contrast (4.5:1 for body text, 3:1 for large
   text and control borders) in both schemes. An automated test checks the token
   pairs.
4. Motion is disabled or reduced when the user prefers reduced motion.
5. Components use tokens only. No hard-coded colors or font sizes in component
   styles.

### R2. Shared components

As a developer, I reuse a small set of components for every feature.

1. `components/ui/` provides: Button (primary, secondary, ghost, danger; sizes;
   loading state), TextField (label, hint, error), Panel, Badge, PageHeader,
   Dialog, Toast, EmptyState, ErrorState, Spinner and Skeleton.
2. Every interactive component is keyboard operable, has a visible focus ring, and
   exposes the right role and label to assistive tech.
3. Dialog traps focus, closes on Escape, and returns focus to its opener.
4. Toasts are announced politely to screen readers and dismiss themselves.
5. Components accept no raw color or size props; variants and sizes are named.
6. Each component renders in jsdom tests with its roles and labels checked.

### R3. App shell

As a signed-in user, I get the same frame and navigation on every page.

1. Signed-in pages share a header with the app name (links home) and a user menu
   showing the display name, with links to Profile and a Sign out action.
2. The shell wraps the page content in a centered, width-limited container with
   responsive padding.
3. League pages get a second level of navigation (tabs on wide screens, a bottom bar
   on phones). F1.5 ships the component with placeholder items; F2 and F4 supply the
   real ones.
4. The sign-in page uses its own full-bleed layout without the shell.
5. Home and Profile move into the shell and use the shared components.
6. A `not-found` page and an error boundary use the shared styling and offer a way
   home.

### R4. URL scheme

1. League pages live under `/leagues/[leagueId]/...`. Reserved sub-paths: `pool`,
   `queue`, `draft`, `screen`, `board`, `settings`.
2. The draft room is `/leagues/[leagueId]/draft`. The big screen is
   `/leagues/[leagueId]/screen`.
3. The scheme is documented in `structure.md`. F1.5 builds no league pages.

### R5. Layout rules

1. **Mobile first.** Layouts are designed at 360px width first, then widened.
   Breakpoints come from tokens. Touch targets are at least 44px.
2. **Draft room.** Dark, immersive, no shell header chrome beyond a slim bar.
3. **Big screen.** Always dark, full-bleed, no header or navigation, large type that
   scales with viewport width, and no controls that need a pointer.
4. These rules are written in the spec and applied by F4, F8 and F9.

### R6. Wireframes

1. The spec contains ASCII wireframes for home, league overview, pre-draft (pool and
   queue), draft room, big screen and board, each at phone and wide size where the
   layouts differ.
2. Wireframes show structure and priority, not final copy. A later spec may adjust
   them and must update them in this spec.

### R7. Date and time formatting

1. A shared formatter renders an ISO timestamp as a date and time in the viewer's own
   time zone, with the zone shown on request.
2. Server-rendered output shows UTC with a "UTC" label, then switches to the viewer's
   zone after load, with no hydration warning.
3. Helpers convert between an ISO timestamp and the value of a
   `datetime-local` input, using the viewer's zone.
4. Invalid input renders a fixed fallback and never throws.

### R8. Component gallery

1. A page at `/dev/components` shows every shared component and each variant, in the
   current scheme, with a toggle to force dark.
2. The page returns `404` unless the dev tools flag is on. The flag is
   `ENABLE_DEV_TOOLS=1`. F2.5 reuses it.
3. The flag is documented in `.env.example` and is never set on Vercel Production.

### R9. Restyle F1 screens

1. Sign-in, Profile and Home use the new components and tokens.
2. Existing behavior and tests keep working.

## Out Of Scope

- Any league, pool, queue, draft or board page (later features).
- A logo or brand artwork beyond text and tokens.
- User-selectable theme toggle. The scheme follows the system.
- Internationalization.

## Open

- Final accent color and font pairing. The design starts with the values in
  `design.md`; adjust from the gallery.
