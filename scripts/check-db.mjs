/**
 * Connectivity check for SUPABASE_DB_URL (loaded from .env.local).
 * Connects, runs `select 1`, and prints the host reached. Never prints the
 * password.
 *
 *   npm run db:check
 */
import { config as loadDotenv } from "dotenv";
import postgres from "postgres";

loadDotenv({ path: ".env.local", override: false, quiet: true });

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error("SUPABASE_DB_URL not set");
  process.exit(1);
}

let hostLabel = "(unparseable)";
try {
  const u = new URL(dbUrl);
  hostLabel = `${u.hostname}:${u.port || "(default)"} user=${u.username}`;
} catch {
  /* ignore */
}
console.log(`Connecting to ${hostLabel} ...`);

const sql = postgres(dbUrl, { max: 1, prepare: false });
try {
  const rows = await sql`select 1 as ok`;
  console.log(`Connected. select 1 -> ${rows[0].ok}`);
} catch (err) {
  console.error(`Connection FAILED: ${err.message}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
