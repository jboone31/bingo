import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/** Draft group reads through the signed-in user's session (members only, by RLS). */

export interface GroupMember {
  readonly userId: string;
  readonly displayName: string;
  readonly position: number;
}

export interface DraftGroup {
  readonly number: number;
  /** In draft order. */
  readonly members: readonly GroupMember[];
}

/** Every group in the league with its order, group 1 first. Empty before the start. */
export const getDraftGroups = cache(
  async (leagueId: string): Promise<DraftGroup[]> => {
    const supabase = createClient(await cookies());
    const [{ data: groups }, { data: members }] = await Promise.all([
      supabase
        .from("draft_groups")
        .select("id, number")
        .eq("league_id", leagueId)
        .order("number", { ascending: true }),
      supabase
        .from("draft_group_members")
        .select("group_id, user_id, position")
        .eq("league_id", leagueId)
        .order("position", { ascending: true }),
    ]);
    if (!groups || groups.length === 0) return [];
    const ids = [...new Set((members ?? []).map((m) => String(m.user_id)))];
    const { data: profiles } =
      ids.length > 0
        ? await supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", ids)
        : { data: [] };
    const names = new Map(
      (profiles ?? []).map((p) => [String(p.id), String(p.display_name)]),
    );
    return groups.map((g) => ({
      number: Number(g.number),
      members: (members ?? [])
        .filter((m) => m.group_id === g.id)
        .map((m) => ({
          userId: String(m.user_id),
          displayName: names.get(String(m.user_id)) ?? "Player",
          position: Number(m.position),
        })),
    }));
  },
);
