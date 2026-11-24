/**
 * Server-only, transaction-capable database helper.
 *
 * `server-only` makes it a build-time error to import this module into a client
 * component. It uses the privileged direct-Postgres connection string and must
 * never reach the browser.
 *
 * Why postgres.js and not the Supabase JS client? A draft pick, its effects, and
 * the event that announces it must commit or roll back together. The Supabase
 * REST client issues independent HTTP requests with no shared transaction;
 * postgres.js opens a real connection and exposes `sql.begin(...)`.
 *
 * Exposes:
 *   - {@link withTransaction}: run a callback inside one transaction. Commits on
 *     normal return, rolls back on any throw.
 *   - {@link getSql}: the lazily-created singleton client, for non-transactional
 *     reads.
 *   - {@link closeDb}: teardown for tests and graceful shutdown.
 */
import "server-only";

import postgres from "postgres";

import { requireServerDbUrl } from "@/lib/env";

/** A single result row. */
export type SqlRow = Record<string, unknown>;

/**
 * The minimal query surface handed to transactional callbacks: positional
 * `$1, $2, ...` parameters, rows returned in `rows`. Values are bound
 * parameters, never string-interpolated.
 */
export interface QueryRunner {
  query(sql: string, params?: readonly unknown[]): Promise<{ rows: SqlRow[] }>;
}

type PgSql = postgres.Sql;
type PgTransaction = postgres.TransactionSql;

/**
 * The singleton client. postgres.js pools internally, so one instance is reused
 * across requests (a new instance per invocation would exhaust connections on
 * serverless).
 */
let sqlSingleton: PgSql | null = null;

/**
 * Return the lazily-created client from `SUPABASE_DB_URL`. Throws
 * `MissingEnvError` if that variable is unset.
 */
export function getSql(): PgSql {
  if (sqlSingleton === null) {
    sqlSingleton = postgres(requireServerDbUrl(), {
      // Small pool: serverless instances multiply, and the Supabase pooler has
      // its own limit.
      max: 5,
      // Required for the Supabase transaction pooler (no prepared statements).
      prepare: false,
    });
  }
  return sqlSingleton;
}

/** Wrap a postgres.js transaction as a {@link QueryRunner}. */
function asQueryRunner(tx: PgTransaction): QueryRunner {
  return {
    async query(sql, params = []) {
      const rows = (await tx.unsafe(
        sql,
        params as postgres.ParameterOrJSON<never>[],
      )) as unknown as SqlRow[];
      return { rows };
    },
  };
}

/**
 * Run `fn` inside a single database transaction and return its result. Every
 * statement `fn` runs through the {@link QueryRunner} shares one transaction;
 * if `fn` throws, the transaction rolls back and the error propagates.
 */
export async function withTransaction<T>(
  fn: (tx: QueryRunner) => Promise<T>,
): Promise<T> {
  const sql = getSql();
  return sql.begin((tx) => fn(asQueryRunner(tx))) as Promise<T>;
}

/**
 * Close the connection pool. After this, the next {@link getSql} or
 * {@link withTransaction} creates a new client.
 */
export async function closeDb(): Promise<void> {
  if (sqlSingleton !== null) {
    const sql = sqlSingleton;
    sqlSingleton = null;
    await sql.end({ timeout: 5 });
  }
}
