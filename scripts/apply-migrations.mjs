/**
 * Migration applier.
 *
 * Applies every `supabase/migrations/NNNN_*.sql` file in ascending numeric
 * order against SUPABASE_DB_URL (loaded from .env.local) using postgres.js. Each
 * migration file wraps its own statements in `begin; ... commit;` and is sent as
 * one multi-statement request.
 *
 * Applied migrations are tracked in a `schema_migrations` ledger table and
 * skipped on later runs, so the script is safe to re-run.
 *
 *   npm run db:migrate                                  # apply un-applied migrations
 *   npm run db:migrate -- --dry-run                     # list what WOULD be applied
 *   npm run db:migrate -- --baseline=N                  # record 0001..000N as applied
 *                                                       #   without running them (adopt an
 *                                                       #   already-migrated database)
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import postgres from "postgres";

loadDotenv({ path: ".env.local", override: false, quiet: true });

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "supabase", "migrations");

/** Parse CLI flags: `--dry-run` and `--baseline=<N>`. */
function parseArgs(argv) {
  let dryRun = false;
  let baseline = null;
  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--baseline=")) {
      const raw = arg.slice("--baseline=".length);
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        console.error(
          `ERROR: --baseline must be a non-negative integer (got "${raw}").`,
        );
        process.exit(1);
      }
      baseline = n;
    } else {
      console.error(`ERROR: unknown argument "${arg}".`);
      console.error(
        "Usage: node scripts/apply-migrations.mjs [--dry-run] [--baseline=<N>]",
      );
      process.exit(1);
    }
  }
  return { dryRun, baseline };
}

const { dryRun, baseline } = parseArgs(process.argv.slice(2));

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl || dbUrl.trim().length === 0) {
  console.error("ERROR: SUPABASE_DB_URL is not set (checked .env.local).");
  process.exit(1);
}

/** The numeric version prefix of a migration file name ("0012_x.sql" -> 12). */
function versionOf(fileName) {
  return Number(fileName.split("_")[0]);
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => /^\d+_.+\.sql$/.test(f))
  .sort((a, b) => versionOf(a) - versionOf(b));

if (files.length === 0) {
  console.error("ERROR: no migration files found in supabase/migrations.");
  process.exit(1);
}

const ENSURE_LEDGER_SQL = `
create table if not exists schema_migrations (
  version     integer primary key,
  name        text not null,
  applied_at  timestamptz not null default now()
)
`;

const sql = postgres(dbUrl, {
  max: 1,
  prepare: false,
  // Keep output clean: swallow non-error NOTICEs.
  onnotice: () => {},
});

let applied = 0;
let skipped = 0;
let recorded = 0;

try {
  await sql.unsafe(ENSURE_LEDGER_SQL);

  const ledgerRows = await sql`select version from schema_migrations`;
  const appliedVersions = new Set(ledgerRows.map((r) => Number(r.version)));

  if (baseline !== null) {
    console.log(
      `Baseline mode: recording migrations up to ${baseline} as applied ` +
        `(no SQL executed)${dryRun ? " [dry run]" : ""}.`,
    );
    for (const file of files) {
      const version = versionOf(file);
      if (version > baseline) continue;
      if (appliedVersions.has(version)) {
        console.log(`  ${file} ... already recorded`);
        continue;
      }
      if (dryRun) {
        console.log(`  ${file} ... WOULD record`);
        recorded += 1;
        continue;
      }
      await sql`
        insert into schema_migrations (version, name)
        values (${version}, ${file})
        on conflict (version) do nothing
      `;
      recorded += 1;
      console.log(`  ${file} ... recorded`);
    }
    console.log(
      `\nDone. Baselined ${recorded} migration(s)${dryRun ? " (dry run)" : ""}.`,
    );
  } else {
    for (const file of files) {
      const version = versionOf(file);
      if (appliedVersions.has(version)) {
        skipped += 1;
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }
      if (dryRun) {
        console.log(`${file} ... WOULD apply`);
        applied += 1;
        continue;
      }
      const body = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`Applying ${file} ... `);
      try {
        // The file owns its own begin/commit. Record it in the ledger once it
        // commits so a re-run skips it.
        await sql.unsafe(body);
        await sql`
          insert into schema_migrations (version, name)
          values (${version}, ${file})
          on conflict (version) do nothing
        `;
        applied += 1;
        console.log("OK");
      } catch (err) {
        console.log("FAILED");
        console.error(`\n  ${file}: ${err.message}\n`);
        throw err;
      }
    }
    console.log(
      dryRun
        ? `\nDry run. Would apply ${applied} migration(s); ${skipped} already applied.`
        : `\nDone. Applied ${applied} migration(s); ${skipped} already applied.`,
    );
  }
} catch {
  console.error(
    `\nStopped after applying ${applied} migration(s) this run. Fix the error ` +
      "above and re-run; applied migrations are recorded in schema_migrations " +
      "and will be skipped.",
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
