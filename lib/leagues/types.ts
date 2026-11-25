export type LeagueStatus = "pre_draft" | "drafting" | "in_progress";
export type MemberRole = "admin" | "member";

/** Most members a league can hold. Also enforced by a database trigger. */
export const MAX_MEMBERS = 100;
