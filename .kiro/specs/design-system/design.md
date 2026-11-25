# F1.5: Design System and App Shell. Design

## Overview

Tokens are CSS custom properties in one file. Components are small React components
with CSS Modules that read only tokens. A route group `app/(app)/` holds the signed-in
shell. Wide-screen and draft views opt into different layouts through layout files
added by later features.

## Tokens

`app/tokens.css`, imported once from `app/layout.tsx`.

Colors use hex so a test can read them. Starting values (the contrast test is the
authority; adjust values from the gallery, not the test):

| Token               | Dark (default) | Light     |
| ------------------- | -------------- | --------- |
| `--color-bg`        | `#0A0E1A`      | `#F2F5FB` |
| `--color-surface`   | `#121A2E`      | `#FFFFFF` |
| `--color-raised`    | `#1B2640`      | `#E6ECF7` |
| `--color-border`    | `#5B6E99`      | `#6B7BA0` |
| `--color-text`      | `#F4F7FF`      | `#0B1226` |
| `--color-muted`     | `#9FB0D0`      | `#44537A` |
| `--color-accent`    | `#FFC400`      | `#FFC400` |
| `--color-on-accent` | `#0A0E1A`      | `#0A0E1A` |
| `--color-accent-ink`| `#FFC400`      | `#7A5A00` |
| `--color-info`      | `#2DE2E6`      | `#00606B` |
| `--color-danger`    | `#FF6B78`      | `#B3202F` |
| `--color-success`   | `#3DDC84`      | `#126B38` |

Other token groups: `--space-1..8` (4px base), `--radius-sm|md|lg`, `--shadow-1|2`,
`--glow-accent`, `--font-display`, `--font-body`, `--text-xs..4xl` (fluid with
`clamp()` for the larger sizes), `--motion-fast|base`, and breakpoints noted in
comments (CSS custom properties cannot be used in media queries, so breakpoints are
fixed values: 640px, 960px, 1280px).

Scheme selection:

```css
:root { /* dark values */ color-scheme: dark; }
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { /* light values */ color-scheme: light; }
}
```

A page or layout can force dark with `data-theme="dark"` on a wrapper element. The
selector scoping lets tokens be overridden on a subtree, so the draft room and big
screen force dark without affecting the shell.

`@media (prefers-reduced-motion: reduce)` sets the motion tokens to `0ms` and removes
glow animations.

## Typography

Loaded with `next/font/google` (self-hosted at build):

- Display: Barlow Condensed (600, 700), uppercase, tight tracking, for headings,
  scoreboard numerals and labels.
- Body: Inter, for text and form controls.

Fonts are exposed as `--font-display` and `--font-body` on `<html>`. Numerals in
countdowns and pick numbers use `font-variant-numeric: tabular-nums`.

## Visual Language

- Panels are dark surfaces with a 1px border and a slight top highlight. Headers use
  a left accent bar.
- Accent (gold) marks the primary action and the "on the clock" state. Cyan marks
  informational highlights. Red and green are reserved for danger and success.
- Primary buttons are solid accent with `--color-on-accent` text and a subtle glow on
  hover and focus. Focus rings are 2px accent with a 2px offset, in both schemes.
- Large numerals (pick number, countdown) use the display font at `--text-4xl`.

## Components

All under `components/ui/`, each as `Name.tsx` plus `Name.module.css` and
`Name.test.tsx`. Server components unless they need state.

| Component    | Notes                                                                 |
| ------------ | --------------------------------------------------------------------- |
| `Button`     | `variant`, `size`, `loading`; renders `<button>`. `ButtonLink` wraps `next/link` with the same look. Loading sets `aria-busy` and disables. |
| `TextField`  | Label always rendered, `hint`, `error` (linked with `aria-describedby`, `aria-invalid`). |
| `Panel`      | Surface with optional title bar and accent bar.                       |
| `Badge`      | `tone`: neutral, accent, info, success, danger.                       |
| `PageHeader` | Title (h1), optional subtitle and actions slot.                       |
| `Dialog`     | Wraps native `<dialog>` with `showModal()`. Focus trap and Escape come from the platform; restores focus to the opener. Client component. |
| `Toast`      | `ToastProvider` and `useToast()`. Region has `role="status"` and `aria-live="polite"`. Auto-dismiss after 5s, pause on hover and focus. Client. |
| `EmptyState` | Icon-free message, optional action.                                   |
| `ErrorState` | Message, optional retry. `role="alert"`.                              |
| `Spinner`, `Skeleton` | Spinner has an accessible label. Skeleton is `aria-hidden`.  |

Variants and sizes are string unions. There are no `style`, `color` or `className`
passthrough props, which keeps screens on tokens. A `className` escape exists only on
layout primitives if a real need appears.

## App Shell

```
app/
  layout.tsx            # html, fonts, tokens, ToastProvider
  tokens.css
  not-found.tsx
  error.tsx
  sign-in/page.tsx      # own layout, no shell
  (app)/
    layout.tsx          # AppShell: header, container
    page.tsx            # home (moved)
    profile/page.tsx    # moved
    dev/components/page.tsx
```

`(app)` is a route group, so URLs do not change (`/`, `/profile`).

`components/shell/`:

- `AppHeader`: app name link, `UserMenu`.
- `UserMenu`: a client component using a button and a popover list (display name,
  Profile, Sign out form). Closes on Escape and outside click; arrow keys not
  required, items are normal tab stops.
- `PageContainer`: max width 72rem, padding from tokens.
- `SubNav`: takes `items: { href, label }[]`; tabs from 640px up, a fixed bottom bar
  below. Marks the current item with `aria-current="page"`. Not mounted until F2.

`(app)/layout.tsx` is a server component. It reads the session and display name once
(`getSessionUser`, `readOwnDisplayName`) and passes them to `AppHeader`.

## URL Scheme

```
/                                   home: my leagues
/profile
/leagues/new                        create
/leagues/join                       enter a code (also /join/[code] for links)
/leagues/[leagueId]                 overview
/leagues/[leagueId]/pool
/leagues/[leagueId]/queue
/leagues/[leagueId]/draft           draft room
/leagues/[leagueId]/screen          big screen
/leagues/[leagueId]/board
/leagues/[leagueId]/settings        admin
```

F2 decides the exact join paths; the reserved league sub-paths are fixed here so
`proxy.ts` and navigation need no later change.

## Layout Rules

- Breakpoints: phone under 640px, tablet 640 to 959px, desktop 960px and up,
  large display 1280px and up.
- Draft room: `data-theme="dark"`, a slim top bar (league name, connection state),
  the pick panel is the largest element, the queue is a side panel from 960px and a
  bottom sheet below.
- Big screen: `data-theme="dark"`, `min-height: 100dvh`, no header, text sized with
  `clamp()` against `vw`, no hover-only information, motion limited to new-pick
  highlights, and honors reduced motion.
- Lists that can grow (pool, feed) scroll inside their panel, so page chrome stays
  put.

## Wireframes

Phone (360px) on the left idea, wide on the right where they differ. `[x]` are
buttons, `(x)` badges.

### Home

```
Phone                          Wide
+------------------------+     +----------------------------------------------+
| BINGO DRAFT        [A] |     | BINGO DRAFT            Leagues     [Ada v]   |
+------------------------+     +----------------------------------------------+
| MY LEAGUES             |     | MY LEAGUES                [Join] [Create]    |
| [Join] [Create]        |     | +----------------+ +----------------+        |
| +--------------------+ |     | | Office 2026    | | Family 2026    |        |
| | Office 2026        | |     | | (Pre-draft)    | | (Drafting)     |        |
| | (Pre-draft) 12 pl. | |     | | Draft: Mar 1   | | Group 2 of 3   |        |
| | Draft: Sat 7:00 PM | |     | +----------------+ +----------------+        |
| +--------------------+ |     +----------------------------------------------+
| | Family 2026        | |
| | (Drafting) now     | |
| +--------------------+ |
+------------------------+
```

### League overview

```
+------------------------------------------------+
| < Office 2026                       (Pre-draft)|
| Draft: Sat Mar 1, 7:00 PM (your time)          |
| Players 12   Pool 340 / 375 needed   Groups 1  |
+------------------------------------------------+
| [Overview] [Pool] [Queue] [Board] [Settings]   |   bottom bar on phones
+------------------------------------------------+
| PLAYERS                  | INVITE               |
| Ada (admin)  Grace  ...  | Code: K7P-2QX [Copy] |
|                          | Link  [Copy]         |
+------------------------------------------------+
```

### Pre-draft: pool and queue

```
Phone: tabs Pool | Queue            Wide: two columns
+---------------------------+       +----------------------+-------------------+
| [Pool] [Queue (7)]        |       | POOL  [Category v]   | MY QUEUE (7)      |
| [Category v] [Sort v]     |       | [Sort v] [search]    | 1 = Team X wins   |
| +-----------------------+ |       | +------------------+ | 2 = ...           |
| | Team X wins title     | |       | | Team X wins ...  | | 3 = ...           |
| | by Sam . Sports  [+]  | |       | | by Sam . Sports  | |  (drag to reorder)|
| +-----------------------+ |       | |             [+]  | |                   |
| | ...                   | |       | +------------------+ |                   |
+---------------------------+       +----------------------+-------------------+
```

### Draft room

```
Wide (dark, immersive)
+--------------------------------------------------------------------------+
| OFFICE 2026 . GROUP 2                                    (Live)  00:42   |
+------------------------------+-------------------------------------------+
|  ON THE CLOCK                |  MY QUEUE                                 |
|  ROUND 7   PICK 3            |  1 Team X wins title              [Pick]  |
|  GRACE                       |  2 ...                                    |
|  00:42                       |  3 ...                                    |
|  [ ====== timer bar ======= ]|                                           |
+------------------------------+-------------------------------------------+
|  AVAILABLE  [Category v][search]        |  MY PICKS (6)  |  GROUP FEED    |
|  ...scrolling list...             [+]   |  R1 ...        |  Ada: ...      |
+------------------------------------------+----------------+----------------+

Phone: on-the-clock panel on top, tabs Available | Picks | Feed, queue as a
bottom sheet opened from a pinned [Queue (7)] button.
```

### Big screen

```
+----------------------------------------------------------------------------+
|  OFFICE 2026 DRAFT                                              GROUP 2    |
|                                                                            |
|   ON THE CLOCK                  ROUND 7 . PICK 3                           |
|   GRACE                         00:42                                      |
|                                                                            |
|   LATEST PICKS                                                             |
|   ADA     R6.2   Team X wins title                                         |
|   SAM     R6.1   ...                                                       |
|   ...                                                                      |
|   GROUP 1 . R7  GROUP 3 . R6   (small, side column)                        |
+----------------------------------------------------------------------------+
```

### Board

```
Phone and wide (square card, fits the shorter side)
+---+---+---+---+---+
| . | . | . | . | . |
+---+---+---+---+---+
| . | . | . | . | . |
+---+---+---+---+---+
| . | . | R1| . | . |    center = round-1 pick
+---+---+---+---+---+
| . | . | . | . | . |
+---+---+---+---+---+
| . | . | . | . | . |
+---+---+---+---+---+
[Export PNG]    [Admin: Export CSV]
```

## Date And Time

`lib/format/dateTime.ts` (pure, no React):

- `formatDateTime(iso: string, options?: { timeZone?: string; showZone?: boolean }):
string`. Uses `Intl.DateTimeFormat`. Returns `"Invalid date"` for unparseable input.
- `isoToLocalInput(iso: string): string | null` returns the `YYYY-MM-DDTHH:mm`
  string for a `datetime-local` input in the viewer's zone, or `null`.
- `localInputToIso(value: string): string | null` returns a UTC ISO string, or
  `null` for empty or invalid input. Uses the `Date` constructor, which reads
  `datetime-local` strings as local time.

`components/LocalTime.tsx` (client): renders
`<time dateTime={iso} suppressHydrationWarning>`. The first render uses
`formatDateTime(iso, { timeZone: "UTC", showZone: true })`. An effect then rewrites it
in the viewer's zone. This avoids server and client text mismatches.

## Gallery And Dev Flag

- `lib/env` gains `isDevToolsEnabled(source = process.env): boolean`, true only when
  `ENABLE_DEV_TOOLS === "1"`.
- `app/(app)/dev/components/page.tsx` calls `notFound()` when the flag is off. It
  lists each component and variant. A client wrapper toggles `data-theme="dark"` on
  the gallery container to compare schemes.
- `.env.example` documents `ENABLE_DEV_TOOLS` (commented out, with a warning).

## Testing

Offline, Vitest:

- **Token contrast**: parse `app/tokens.css`, resolve each token for dark and light,
  and assert the pairs: text on bg, text on surface, text on raised, muted on bg,
  muted on surface, on-accent on accent, accent-ink on bg and surface (per scheme),
  info, danger and success on surface, and border on bg at 3:1. Also assert every
  color token used in the pairs is a 6-digit hex.
- **No hard-coded colors**: a smoke test scans `components/**/*.module.css` and
  asserts no hex or `rgb(` literal appears (tokens file excluded).
- **Components**: jsdom tests for roles, labels, `aria-*` wiring, loading state,
  Dialog open and close, Toast announcements and dismissal.
- **Formatting**: examples for `formatDateTime` in fixed zones, invalid input, and
  `localInputToIso` and `isoToLocalInput`; a fast-check property that
  `formatDateTime` never throws for any string and returns a non-empty string.
- **Shell**: `AppHeader` and `UserMenu` render the name and a sign-out form that posts
  to `/api/auth/sign-out`. `SubNav` marks the current item.
- **Gallery**: returns not found when the flag is off.
- Existing F1 page tests are updated, not removed.

## Structure Updates

- `structure.md`: add `components/ui/`, `components/shell/`, the `(app)` route group,
  `app/tokens.css`, `lib/format/`, the URL scheme, and `ENABLE_DEV_TOOLS`.
- `conventions.md`: add a Design rule: styles use tokens only; shared components come
  from `components/ui/`; new screens follow the layout rules in this spec.
