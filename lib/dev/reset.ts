import "server-only";
import type { QueryRunner } from "@/lib/db/server";
import { withTransaction } from "@/lib/db/server";
import { deleteAllSeedUsers } from "./seedUsers";

/**
 * Reset only ever deletes leagues with a `seed_scenario` tag, and users that match
 * the reserved seed pattern (see {@link deleteAllSeedUsers}). Real leagues and real
 * users are unreachable from here.
 */

export interface ResetCounts {
  readonly leagues: number;
  readonly users: number;
}

/** Seed leagues the user belongs to. */
export async function resetMine(
  tx: QueryRunner,
  userId: string,
): Promise<number> {
  const { rows } = await tx.query(
    `delete from public.leagues
      where seed_scenario is not null
        and id in (select league_id from public.league_members where user_id = $1)
      returning id`,
    [userId],
  );
  return rows.length;
}

/** Every seed league, then every seed user. */
export async function resetAll(): Promise<ResetCounts> {
  const leagues = await withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `delete from public.leagues where seed_scenario is not null returning id`,
    );
    return rows.length;
  });
  const users = await deleteAllSeedUsers();
  return { leagues, users };
}
