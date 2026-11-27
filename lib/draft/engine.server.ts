import "server-only";
import { ApiError } from "@/lib/api/errors";
import type { QueryRunner } from "@/lib/db/server";

/**
 * Wrappers for the SQL draft engine (migration 0011). The functions take the league
 * row lock themselves, so callers may use them inside any transaction. Refusals the
 * engine raises become {@link ApiError}s; anything else propagates (a 500).
 */

const REFUSALS: Record<string, number> = {
  draft_not_running: 409,
  not_your_turn: 409,
  stale_pick: 409,
  square_taken: 409,
  submission_not_found: 404,
};

/** Turn a raised engine reason into an ApiError, or rethrow. */
export function mapEngineError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (Object.hasOwn(REFUSALS, message)) {
    throw new ApiError(message, REFUSALS[message]);
  }
  throw error;
}

/** Auto-pick every due turn. Returns the number of auto-picks. */
export async function settleLeague(
  tx: QueryRunner,
  leagueId: string,
): Promise<number> {
  const { rows } = await tx.query(`select public.settle_league($1) as n`, [
    leagueId,
  ]);
  return Number(rows[0].n);
}

/**
 * Settle first when the league is drafting, for writes that would otherwise take a
 * weaker lock (queue writes hold the league `for share`). The status is read without
 * a lock: settling takes `for update`, and doing that after a `for share` in the same
 * transaction could deadlock two writers. A status that changes meanwhile can only be
 * the start, when nothing is due yet.
 */
export async function settleIfDrafting(
  tx: QueryRunner,
  leagueId: string,
): Promise<void> {
  const { rows } = await tx.query(
    `select status from public.leagues where id = $1`,
    [leagueId],
  );
  if (rows[0]?.status === "drafting") await settleLeague(tx, leagueId);
}

/** A manual pick. Settles first. */
export async function makePick(
  tx: QueryRunner,
  input: {
    leagueId: string;
    userId: string;
    submissionId: string;
    pickNumber: number;
  },
): Promise<{ alreadyPicked: boolean }> {
  try {
    const { rows } = await tx.query(
      `select public.draft_pick($1, $2, $3, $4) as result`,
      [input.leagueId, input.userId, input.submissionId, input.pickNumber],
    );
    return { alreadyPicked: rows[0].result === "already_picked" };
  } catch (error) {
    mapEngineError(error);
  }
}

/** Create the clocks for a just-started league. */
export async function createClocks(
  tx: QueryRunner,
  leagueId: string,
): Promise<void> {
  await tx.query(`select public.create_draft_clocks($1)`, [leagueId]);
}

/** The database clock in milliseconds (transaction time). */
export async function databaseNow(tx: QueryRunner): Promise<number> {
  const { rows } = await tx.query(
    `select (extract(epoch from clock_timestamp()) * 1000)::bigint as ms`,
  );
  return Number(rows[0].ms);
}

/** Dev: every running deadline becomes now, then settle. */
export async function devExpire(
  tx: QueryRunner,
  leagueId: string,
): Promise<number> {
  await tx.query(
    `update public.draft_clocks set deadline = now()
      where league_id = $1 and finished_at is null`,
    [leagueId],
  );
  return settleLeague(tx, leagueId);
}

/** Dev: turn seed-player bots on or off, then settle. */
export async function setDevBots(
  tx: QueryRunner,
  leagueId: string,
  on: boolean,
): Promise<number> {
  await tx.query(`update public.leagues set dev_bots = $2 where id = $1`, [
    leagueId,
    on,
  ]);
  return settleLeague(tx, leagueId);
}

/** Dev seeding: force `picksPerGroup` auto-picks in each group. */
export async function devAdvance(
  tx: QueryRunner,
  leagueId: string,
  picksPerGroup: number,
): Promise<number> {
  const { rows } = await tx.query(
    `select public.dev_draft_advance($1, $2) as n`,
    [leagueId, picksPerGroup],
  );
  return Number(rows[0].n);
}
