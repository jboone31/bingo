import "server-only";
import type { QueryRunner } from "@/lib/db/server";
import { cleanName } from "./payload";
import type { EventDraft } from "./types";

/**
 * Append one event to a league's log inside the caller's transaction, so the change
 * and its event commit or roll back together. Call it only when something actually
 * changed. Returns the event's seq.
 */
export async function appendLeagueEvent(
  tx: QueryRunner,
  leagueId: string,
  actorId: string | null,
  event: EventDraft,
): Promise<number> {
  // Cast through text: postgres.js would send a string bound to `$3::jsonb` as a
  // JSON string ("{...}"), not an object, and the payload check would refuse it.
  const { rows } = await tx.query(
    `select public.append_league_event($1, $2, $3::text::jsonb, $4) as seq`,
    [leagueId, event.type, JSON.stringify(event.payload), actorId],
  );
  return Number(rows[0].seq);
}

/** A user's display name for an event payload ("Someone" if there is none). */
export async function displayNameOf(
  tx: QueryRunner,
  userId: string,
): Promise<string> {
  const { rows } = await tx.query(
    `select display_name from public.profiles where id = $1`,
    [userId],
  );
  return cleanName(rows[0] ? String(rows[0].display_name) : null);
}
