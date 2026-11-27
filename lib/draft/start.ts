import "server-only";
import { randomInt } from "node:crypto";
import { ApiError } from "@/lib/api/errors";
import type { QueryRunner } from "@/lib/db/server";
import { appendLeagueEvent } from "@/lib/events/append";
import { draftStarted } from "@/lib/events/payload";
import { lockLeagueForMember } from "@/lib/leagues/guard";
import { countSubmissions } from "@/lib/pool/queries";
import { insertGroups, listMemberIds, markStarted } from "./queries";
import { canStart } from "./rules";
import { splitIntoGroups, type RandomInt } from "./split";

export interface StartExpectation {
  readonly members: number;
  readonly groupCount: number;
}

/**
 * Start a league's draft inside the caller's transaction. Holds the league row lock
 * for update, so it cannot interleave with joins, pool or queue writes. Shared by the
 * start route and dev seeding. Throws {@link ApiError} for a refusal.
 */
export async function startDraft(
  tx: QueryRunner,
  leagueId: string,
  actorId: string,
  expected: StartExpectation,
  random: RandomInt = (max) => randomInt(max),
): Promise<{ alreadyStarted: boolean }> {
  const { league, role } = await lockLeagueForMember(tx, leagueId, actorId);
  const memberIds = await listMemberIds(tx, leagueId);
  const decision = canStart({
    status: league.status,
    actorRole: role,
    members: memberIds.length,
    groups: league.groupCount,
    pool:
      league.status === "pre_draft" ? await countSubmissions(tx, leagueId) : 0,
    expected,
  });
  if (decision.kind === "deny") {
    throw new ApiError(decision.reason, decision.status);
  }
  if (decision.kind === "already_started") return { alreadyStarted: true };

  await markStarted(tx, leagueId);
  const plan = splitIntoGroups(memberIds, league.groupCount, random);
  await insertGroups(tx, leagueId, plan);
  await appendLeagueEvent(
    tx,
    leagueId,
    actorId,
    draftStarted(
      league.groupCount,
      plan.map((g) => g.members.length),
    ),
  );
  return { alreadyStarted: false };
}
