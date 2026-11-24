# Bingo Draft

An annual bingo draft web app. Players join leagues, draft squares in snake-order
groups, and get generated 5x5 boards. Built with Next.js (App Router), TypeScript,
Vercel, and Supabase.

Project direction lives in `.kiro/steering/` (`product`, `tech`, `structure`,
`draft-rules`, `roadmap`).

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
| `npm run test:integration` | Live database tests (loads `.env.local`)        |
| `npm run db:check`         | Check the database connection                   |
| `npm run db:migrate`       | Apply new migrations (`-- --dry-run` to preview) |

`GET /api/health` reports app and database status.
