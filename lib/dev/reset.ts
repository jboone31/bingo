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

/**
 * One seed league, in any status, if the user belongs to it. Leagues without a
 * `seed_scenario` tag are never touched. Returns whether it was deleted.
 */
export async function resetOne(
  tx: QueryRunner,
  userId: string,
  leagueId: string,
): Promise<boolean> {
  const { rows } = await tx.query(
    `delete from public.leagues
      where id = $2
        and seed_scenario is not null
        and id in (select league_id from public.league_members where user_id = $1)
      returning id`,
    [userId, leagueId],
  );
  return rows.length > 0;
}

export interface SeedLeague {
  readonly id: string;
  readonly name: string;
  readonly scenario: string;
  readonly status: string;
  /** ISO timestamp. */
  readonly createdAt: string;
}

/** The seed leagues the user belongs to, newest first. */
export async function listMySeedLeagues(
  tx: QueryRunner,
  userId: string,
): Promise<SeedLeague[]> {
  const { rows } = await tx.query(
    `select l.id, l.name, l.seed_scenario, l.status, l.created_at
       from public.leagues l
       join public.league_members m on m.league_id = l.id and m.user_id = $1
      where l.seed_scenario is not null
      order by l.created_at desc`,
    [userId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    scenario: String(r.seed_scenario),
    status: String(r.status),
    createdAt: new Date(r.created_at as string | Date).toISOString(),
  }));
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
