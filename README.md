# Bingo Draft

An annual bingo draft web app. Players join leagues, draft squares in snake-order
groups, and get generated 5x5 boards. Built with Next.js (App Router), TypeScript,
Vercel, and Supabase.

Project direction lives in `.kiro/steering/` (`product`, `tech`, `structure`,
`draft-rules`, `conventions`, `workflow`, `roadmap`). Feature specs live in
`.kiro/specs/`. Start with `roadmap.md` ("Status And Handoff") and `workflow.md`.

## Local setup

Requires Node 26 (`nvm use`).

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run db:check             # confirm the database connection
npm run db:migrate           # apply migrations
npm run dev                  # http://localhost:3000
```

`.env.local` needs `CRON_SECRET` (any long random value, for example
`openssl rand -hex 32`) in addition to the Supabase variables.

## Scripts

| Script                     | What it does                                    |
| -------------------------- | ----------------------------------------------- |
| `npm run dev`              | Start the dev server                            |
| `npm run build`            | Production build                                |
| `npm run typecheck`        | Type check                                      |
| `npm run lint`             | ESLint                                          |
| `npm run format:check`     | Prettier check (`npm run format` to fix)        |
| `npm test`                 | Unit and property tests (offline)               |
| `npm run test:integration` | Live database tests (loads `.env.local`); add `-- <name>` to pick suites |
| `npm run db:check`         | Check the database connection                   |
| `npm run db:migrate`       | Apply new migrations (`-- --dry-run` to preview) |

`GET /api/health` reports app and database status.

## Dev tools

Dev, preview and production share one Supabase project, so everything you create while
testing is real data. Dev tools are off unless you opt in:

1. Add `ENABLE_DEV_TOOLS=1` to `.env.local` and restart `npm run dev`. Never set it on
   Vercel Production (the tools also stay off whenever `VERCEL_ENV=production`).
2. Open `/dev` to build a league in a chosen state (seed scenarios), reset seed data,
   or act as a fake player. `/dev/components` shows every shared UI component.

Seed data is tagged: leagues have a `seed_scenario`, and fake players use
`seed-player-NNN@bingo-seed.test`. Reset only removes those.

## Testing on a phone

`npm run dev` prints a "Network" address such as `http://192.168.1.20:3000`. Open it on a
phone on the same Wi-Fi (`next.config.ts` allows private-network origins in dev). Google
sign-in does not work from that address, so use the "Dev sign-in" panel on the sign-in
page, which needs `ENABLE_DEV_TOOLS=1` and at least one seed player (run a scenario
from `/dev` on your computer first).
