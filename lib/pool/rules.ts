import type { RuleResult } from "@/lib/leagues/rules";
import type { LeagueStatus, MemberRole } from "@/lib/leagues/types";
import { MAX_SUBMISSIONS } from "./limits";

/** Pool rules as pure decisions over plain data, like `lib/leagues/rules.ts`. */

/** Editing the pool: admin only, only while pre_draft. */
export function canEditPool(input: {
  status: LeagueStatus;
  actorRole: MemberRole;
}): RuleResult {
  if (input.actorRole !== "admin") {
    return { ok: false, reason: "not_admin", status: 403 };
  }
  if (input.status !== "pre_draft") {
    return { ok: false, reason: "league_not_pre_draft", status: 409 };
  }
  return { ok: true };
}

/** Adding rows: the edit rules plus the 5,000-row cap. */
export function canAddSubmissions(input: {
  status: LeagueStatus;
  actorRole: MemberRole;
  currentCount: number;
  adding: number;
}): RuleResult {
  const base = canEditPool(input);
  if (!base.ok) return base;
  if (input.currentCount + input.adding > MAX_SUBMISSIONS) {
    return { ok: false, reason: "pool_full", status: 409 };
  }
  return { ok: true };
}
