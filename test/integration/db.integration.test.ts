import { afterAll, describe, expect, it } from "vitest";

import { closeDb, getSql, withTransaction } from "@/lib/db/server";

/**
 * Live database checks. Run with `npm run test:integration`. Skipped when
 * SUPABASE_DB_URL is not set.
 */
const hasDb = Boolean(process.env.SUPABASE_DB_URL?.trim());

describe.skipIf(!hasDb)("database connectivity", () => {
  afterAll(async () => {
    await closeDb();
  });

  it("runs select 1", async () => {
    const rows = await getSql()`select 1 as ok`;
    expect(rows[0].ok).toBe(1);
  });

  it("commits a transaction's work", async () => {
    const result = await withTransaction(async (tx) => {
      const { rows } = await tx.query("select $1::int as n", [41]);
      return Number(rows[0].n) + 1;
    });
    expect(result).toBe(42);
  });

  it("rolls back when the callback throws", async () => {
    const table = `tx_probe_${Date.now()}`;
    await expect(
      withTransaction(async (tx) => {
        await tx.query(`create table ${table} (n int)`);
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // DDL is transactional in Postgres, so the table must not exist.
    const rows = await getSql()`select to_regclass(${table}) as t`;
    expect(rows[0].t).toBeNull();
  });

  it("has pg_cron installed", async () => {
    const rows = await getSql()`
      select 1 from pg_extension where extname = 'pg_cron'
    `;
    expect(rows.length).toBe(1);
  });
});
