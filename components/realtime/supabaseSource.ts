import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventSource } from "@/lib/events/feed";
import type { EventRow } from "@/lib/events/rows";

const COLUMNS = "id, league_id, seq, type, payload, actor_id, created_at";

/**
 * A league's events through Supabase: Realtime inserts for the push, and an RLS read
 * for catch-up. Realtime applies the same select policy per subscriber, so a person
 * who is not a member (or no longer is) receives nothing.
 */
export function supabaseEventSource(
  supabase: SupabaseClient,
  leagueId: string,
): EventSource {
  return {
    subscribe(onInsert, onStatus) {
      const channel = supabase
        .channel(`league:${leagueId}:events`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "league_events",
            filter: `league_id=eq.${leagueId}`,
          },
          (payload) => onInsert(payload.new as EventRow),
        )
        .subscribe((status) => {
          if (status === "SUBSCRIBED") onStatus("subscribed");
          else onStatus("down");
        });
      return () => {
        void supabase.removeChannel(channel);
      };
    },

    async fetchAfter(afterSeq, limit) {
      const { data, error } = await supabase
        .from("league_events")
        .select(COLUMNS)
        .eq("league_id", leagueId)
        .gt("seq", afterSeq)
        .order("seq", { ascending: true })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data ?? []) as EventRow[];
    },
  };
}
