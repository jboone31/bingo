import type { LeagueEvent } from "./types";

/** A `league_events` row as the Supabase client returns it (snake_case). */
export interface EventRow {
  id: string;
  league_id: string;
  seq: number | string;
  type: string;
  payload: unknown;
  actor_id: string | null;
  created_at: string;
}

/**
 * Convert a row to a {@link LeagueEvent}. `seq` is a bigint column, which can arrive
 * as a string. Returns null for a row that is not usable, so a bad row is skipped
 * rather than breaking the feed.
 */
export function eventFromRow(
  row: EventRow | null | undefined,
): LeagueEvent | null {
  if (!row) return null;
  const seq = Number(row.seq);
  if (!Number.isSafeInteger(seq) || seq < 1) return null;
  if (typeof row.id !== "string" || typeof row.league_id !== "string")
    return null;
  if (typeof row.type !== "string") return null;
  const payload =
    row.payload !== null &&
    typeof row.payload === "object" &&
    !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    leagueId: row.league_id,
    seq,
    type: row.type,
    payload,
    actorId: row.actor_id ?? null,
    createdAt: String(row.created_at),
  };
}
