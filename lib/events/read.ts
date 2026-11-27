import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { eventFromRow, type EventRow } from "./rows";
import type { LeagueEvent } from "./types";

/** The newest `limit` events of a league, newest first, read through RLS. */
export async function getRecentEvents(
  leagueId: string,
  limit: number,
): Promise<LeagueEvent[]> {
  const supabase = createClient(await cookies());
  const { data } = await supabase
    .from("league_events")
    .select("id, league_id, seq, type, payload, actor_id, created_at")
    .eq("league_id", leagueId)
    .order("seq", { ascending: false })
    .limit(limit);
  const events: LeagueEvent[] = [];
  for (const row of (data ?? []) as EventRow[]) {
    const event = eventFromRow(row);
    if (event) events.push(event);
  }
  return events;
}
