import type { RuleResult } from "@/lib/leagues/rules";
import type { LeagueStatus } from "@/lib/leagues/types";

/** Most squares one member can queue. Also enforced by a database trigger. */
export const QUEUE_MAX = 200;

/** Queue changes: any member, only while pre_draft (F7 extends this). */
export function canEditQueue(input: { status: LeagueStatus }): RuleResult {
  if (input.status !== "pre_draft") {
    return { ok: false, reason: "league_not_pre_draft", status: 409 };
  }
  return { ok: true };
}

/** Adding to the queue: the edit rule plus the size limit. */
export function canAddToQueue(input: {
  status: LeagueStatus;
  count: number;
}): RuleResult {
  const base = canEditQueue(input);
  if (!base.ok) return base;
  if (input.count >= QUEUE_MAX) {
    return { ok: false, reason: "queue_full", status: 409 };
  }
  return { ok: true };
}
