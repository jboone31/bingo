/**
 * League membership rules as pure decisions over plain data. Routes load the data
 * inside a locked transaction, call these, then write. The database enforces the
 * hard limits again as a backstop.
 */
import { MAX_MEMBERS, type LeagueStatus, type MemberRole } from "./types";

export type RuleResult =
  { ok: true } | { ok: false; reason: string; status: number };

const ALLOWED: RuleResult = { ok: true };
const deny = (reason: string, status: number): RuleResult => ({
  ok: false,
  reason,
  status,
});

/** Whether a typed league name matches the real one, ignoring case and edge spaces. */
export function namesMatch(typed: string, actual: string): boolean {
  return typed.trim().toLowerCase() === actual.toLowerCase();
}

const notPreDraft = () => deny("league_not_pre_draft", 409);
const notAdmin = () => deny("not_admin", 403);

/** Joining: a member rejoining succeeds as a no-op; otherwise pre_draft and room. */
export function canJoin(input: {
  status: LeagueStatus;
  memberCount: number;
  alreadyMember: boolean;
}): RuleResult {
  if (input.alreadyMember) return ALLOWED;
  if (input.status !== "pre_draft") return notPreDraft();
  if (input.memberCount >= MAX_MEMBERS) return deny("league_full", 409);
  return ALLOWED;
}

/** Leaving: never the admin, and only while pre_draft. */
export function canLeave(input: {
  status: LeagueStatus;
  role: MemberRole;
}): RuleResult {
  if (input.role === "admin") return deny("admin_cannot_leave", 409);
  if (input.status !== "pre_draft") return notPreDraft();
  return ALLOWED;
}

/** Removing another member: admin only, not oneself, only while pre_draft. */
export function canRemove(input: {
  status: LeagueStatus;
  actorRole: MemberRole;
  isSelf: boolean;
}): RuleResult {
  if (input.actorRole !== "admin") return notAdmin();
  if (input.isSelf) return deny("cannot_remove_self", 409);
  if (input.status !== "pre_draft") return notPreDraft();
  return ALLOWED;
}

/** Regenerating the join code: admin only, only while pre_draft. */
export function canRegenerateCode(input: {
  status: LeagueStatus;
  actorRole: MemberRole;
}): RuleResult {
  if (input.actorRole !== "admin") return notAdmin();
  if (input.status !== "pre_draft") return notPreDraft();
  return ALLOWED;
}

/** Transferring admin: admin only, to a current member, in any status. */
export function canTransfer(input: {
  actorRole: MemberRole;
  targetIsMember: boolean;
}): RuleResult {
  if (input.actorRole !== "admin") return notAdmin();
  if (!input.targetIsMember) return deny("target_not_member", 409);
  return ALLOWED;
}

/**
 * Deleting: admin only, only while pre_draft, and the typed name must match. Case
 * is ignored because headings display league names in capitals.
 */
export function canDelete(input: {
  status: LeagueStatus;
  actorRole: MemberRole;
  confirmName: string;
  leagueName: string;
}): RuleResult {
  if (input.actorRole !== "admin") return notAdmin();
  if (input.status !== "pre_draft") return notPreDraft();
  if (!namesMatch(input.confirmName, input.leagueName)) {
    return deny("confirmation_mismatch", 400);
  }
  return ALLOWED;
}
