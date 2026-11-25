import "server-only";
import { ApiError } from "@/lib/api/errors";
import type { QueryRunner } from "@/lib/db/server";
import { getMemberRole, lockLeagueById, type LeagueRow } from "./queries";
import type { RuleResult } from "./rules";
import type { MemberRole } from "./types";

/** Throw the rule's reason as an {@link ApiError} unless it allowed the action. */
export function assertAllowed(result: RuleResult): void {
  if (!result.ok) {
    throw new ApiError(result.reason, result.status);
  }
}

/**
 * Lock the league and load the caller's role. A missing league and a caller who
 * is not a member look the same (`league_not_found`), so existence is not leaked.
 */
export async function lockLeagueForMember(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
): Promise<{ league: LeagueRow; role: MemberRole }> {
  const league = await lockLeagueById(tx, leagueId);
  const role = league ? await getMemberRole(tx, leagueId, userId) : null;
  if (league === null || role === null) {
    throw new ApiError("league_not_found", 404);
  }
  return { league, role };
}
