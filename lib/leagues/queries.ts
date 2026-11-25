import "server-only";
import { randomInt } from "node:crypto";
import type { QueryRunner } from "@/lib/db/server";
import { generateJoinCode } from "./joinCode";
import type { LeagueStatus, MemberRole } from "./types";

/** All SQL for leagues and members. Callers hold the league lock (see below). */

export interface LeagueRow {
  readonly id: string;
  readonly name: string;
  readonly status: LeagueStatus;
  readonly draftAt: string | null;
  readonly joinCode: string;
}

const LEAGUE_COLUMNS = "id, name, status, draft_at, join_code";

function toLeague(row: Record<string, unknown>): LeagueRow {
  const draftAt = row.draft_at;
  return {
    id: String(row.id),
    name: String(row.name),
    status: row.status as LeagueStatus,
    draftAt:
      draftAt === null || draftAt === undefined
        ? null
        : new Date(draftAt as string | Date).toISOString(),
    joinCode: String(row.join_code),
  };
}

const newCode = () => generateJoinCode((max) => randomInt(max));

/** Lock the league row for the rest of the transaction. `null` if missing. */
export async function lockLeagueById(
  tx: QueryRunner,
  id: string,
): Promise<LeagueRow | null> {
  const { rows } = await tx.query(
    `select ${LEAGUE_COLUMNS} from public.leagues where id = $1 for update`,
    [id],
  );
  return rows[0] ? toLeague(rows[0]) : null;
}

/** Lock the league that owns a normalized join code. `null` if none. */
export async function lockLeagueByCode(
  tx: QueryRunner,
  code: string,
): Promise<LeagueRow | null> {
  const { rows } = await tx.query(
    `select ${LEAGUE_COLUMNS} from public.leagues where join_code = $1 for update`,
    [code],
  );
  return rows[0] ? toLeague(rows[0]) : null;
}

export async function getMemberRole(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
): Promise<MemberRole | null> {
  const { rows } = await tx.query(
    `select role from public.league_members where league_id = $1 and user_id = $2`,
    [leagueId, userId],
  );
  return rows[0] ? (rows[0].role as MemberRole) : null;
}

export async function countMembers(
  tx: QueryRunner,
  leagueId: string,
): Promise<number> {
  const { rows } = await tx.query(
    `select count(*)::int as n from public.league_members where league_id = $1`,
    [leagueId],
  );
  return Number(rows[0].n);
}

export async function insertMember(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
  role: MemberRole,
): Promise<void> {
  await tx.query(
    `insert into public.league_members (league_id, user_id, role)
     values ($1, $2, $3)`,
    [leagueId, userId, role],
  );
}

export async function deleteMember(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
): Promise<void> {
  await tx.query(
    `delete from public.league_members where league_id = $1 and user_id = $2`,
    [leagueId, userId],
  );
}

export async function setRole(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
  role: MemberRole,
): Promise<void> {
  await tx.query(
    `update public.league_members set role = $3
      where league_id = $1 and user_id = $2`,
    [leagueId, userId, role],
  );
}

/** Replace the join code with a fresh unused one. Returns the new code. */
export async function setJoinCode(
  tx: QueryRunner,
  leagueId: string,
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = newCode();
    const { rows } = await tx.query(
      `update public.leagues set join_code = $2
        where id = $1
          and not exists (select 1 from public.leagues where join_code = $2)
        returning join_code`,
      [leagueId, code],
    );
    if (rows[0]) {
      return String(rows[0].join_code);
    }
  }
  throw new Error("could not allocate a join code");
}

export async function deleteLeague(
  tx: QueryRunner,
  leagueId: string,
): Promise<void> {
  await tx.query(`delete from public.leagues where id = $1`, [leagueId]);
}

/**
 * Create a league and its admin membership. Repeating the same `requestId` for
 * the same user returns the league created the first time.
 */
export async function createLeague(
  tx: QueryRunner,
  input: {
    name: string;
    draftAt: string | null;
    userId: string;
    requestId: string;
    /** Set only by dev tools, so reset can find the league. */
    seedScenario?: string;
  },
): Promise<{ id: string; created: boolean }> {
  const existing = async () => {
    const { rows } = await tx.query(
      `select id from public.leagues where created_by = $1 and create_key = $2`,
      [input.userId, input.requestId],
    );
    return rows[0] ? String(rows[0].id) : null;
  };

  const before = await existing();
  if (before !== null) {
    return { id: before, created: false };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { rows } = await tx.query(
      `insert into public.leagues
         (name, draft_at, join_code, created_by, create_key, seed_scenario)
       values ($1, $2, $3, $4, $5, $6)
       on conflict do nothing
       returning id`,
      [
        input.name,
        input.draftAt,
        newCode(),
        input.userId,
        input.requestId,
        input.seedScenario ?? null,
      ],
    );
    if (rows[0]) {
      const id = String(rows[0].id);
      await insertMember(tx, id, input.userId, "admin");
      return { id, created: true };
    }
    // A conflict is either a repeated request (a concurrent twin won) or a code
    // collision. Return the twin's league, or try a new code.
    const twin = await existing();
    if (twin !== null) {
      return { id: twin, created: false };
    }
  }
  throw new Error("could not allocate a join code");
}
