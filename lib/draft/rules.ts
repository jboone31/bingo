import type { RuleResult } from "@/lib/leagues/rules";
import type { LeagueStatus, MemberRole } from "@/lib/leagues/types";
import { startGate } from "./gate";

const ALLOWED: RuleResult = { ok: true };

/** Changing the group count or timer: admin only, only while pre_draft. */
export function canChangeDraftSettings(input: {
  status: LeagueStatus;
  actorRole: MemberRole;
}): RuleResult {
  if (input.actorRole !== "admin") {
    return { ok: false, reason: "not_admin", status: 403 };
  }
  if (input.status !== "pre_draft") {
    return { ok: false, reason: "league_not_pre_draft", status: 409 };
  }
  return ALLOWED;
}

export type StartDecision =
  | { kind: "start" }
  | { kind: "already_started" }
  | { kind: "deny"; reason: string; status: number };

/**
 * Whether the admin may start now. A league past pre_draft is already started (a
 * success for the admin, so a repeat is harmless). `expected` is what the admin
 * confirmed; any difference from current data refuses, so they can review it.
 */
export function canStart(input: {
  status: LeagueStatus;
  actorRole: MemberRole;
  members: number;
  groups: number;
  pool: number;
  expected: { members: number; groupCount: number };
}): StartDecision {
  if (input.actorRole !== "admin") {
    return { kind: "deny", reason: "not_admin", status: 403 };
  }
  if (input.status !== "pre_draft") return { kind: "already_started" };
  if (
    input.expected.members !== input.members ||
    input.expected.groupCount !== input.groups
  ) {
    return { kind: "deny", reason: "draft_setup_changed", status: 409 };
  }
  const gate = startGate(input);
  if (!gate.ok) return { kind: "deny", reason: gate.reason, status: 409 };
  return { kind: "start" };
}
