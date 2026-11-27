import type { EventDraft, PoolChangeKind } from "./types";

/**
 * Builders for the events routes append. Payloads hold display names and counts
 * only (never the join code, CSV rows or emails). Names are copied in so the feed
 * still reads correctly after the person has left.
 */
const MAX_NAME = 60;

/** A display name made safe for a payload: trimmed, never empty, at most 60 chars. */
export function cleanName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (trimmed === "") return "Someone";
  return Array.from(trimmed).slice(0, MAX_NAME).join("");
}

export const memberJoined = (name: string): EventDraft => ({
  type: "member_joined",
  payload: { name: cleanName(name) },
});

export const memberLeft = (name: string): EventDraft => ({
  type: "member_left",
  payload: { name: cleanName(name) },
});

export const memberRemoved = (name: string): EventDraft => ({
  type: "member_removed",
  payload: { name: cleanName(name) },
});

export const adminTransferred = (from: string, to: string): EventDraft => ({
  type: "admin_transferred",
  payload: { from: cleanName(from), to: cleanName(to) },
});

/** `draftAt` is the new ISO value, or null when the date was cleared. */
export const draftDateChanged = (draftAt: string | null): EventDraft => ({
  type: "draft_date_changed",
  payload: { draftAt },
});

export const joinCodeRegenerated = (): EventDraft => ({
  type: "join_code_regenerated",
  payload: {},
});

export const poolChanged = (
  kind: PoolChangeKind,
  count: number,
): EventDraft => ({
  type: "pool_changed",
  payload: { kind, count: Math.max(0, Math.trunc(count)) },
});
