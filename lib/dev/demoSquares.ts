import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { importCsv } from "@/lib/pool/importCsv";
import type { SeedSubmission } from "./scenarios";

/**
 * Demo squares for seed pools: real squares from earlier years, in
 * `lib/dev/demo_squares.csv`. Parsed with the pool's own CSV import, so they meet the
 * same rules as an upload. `next.config.ts` traces the file into the seed route's
 * deployment bundle.
 */
export const DEMO_SQUARES_FILE = path.join(
  process.cwd(),
  "lib",
  "dev",
  "demo_squares.csv",
);

/** Parse demo-square CSV text. Throws if any row is invalid. */
export function parseDemoSquares(csv: string): SeedSubmission[] {
  const result = importCsv(csv);
  if (!result.ok) {
    throw new Error(
      `demo squares are invalid: ${result.reason} (${result.totalErrors} problem(s))`,
    );
  }
  return result.rows.map((row) => ({
    text: row.text,
    submitter: row.submitter,
    category: row.category,
  }));
}

let cached: SeedSubmission[] | null = null;

/** The demo squares, read once per server process. */
export function demoSquares(): SeedSubmission[] {
  if (cached === null) {
    cached = parseDemoSquares(readFileSync(DEMO_SQUARES_FILE, "utf8"));
  }
  return cached;
}
