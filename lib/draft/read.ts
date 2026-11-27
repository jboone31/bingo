import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { onClock } from "./engine";

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

export interface RecentPick {
  readonly pickNumber: number;
  readonly round: number;
  readonly displayName: string;
  readonly text: string;
  readonly auto: boolean;
}

export interface GroupStatus {
  readonly number: number;
  readonly memberIds: readonly string[];
  /** The next pick, 1-based. */
  readonly pickNumber: number;
  readonly totalPicks: number;
  readonly round: number;
  readonly onClock: {
    readonly userId: string;
    readonly displayName: string;
  } | null;
  /** ISO, or null once the group is finished. */
  readonly deadline: string | null;
  readonly finished: boolean;
  /** Newest first. */
  readonly recent: readonly RecentPick[];
}

const RECENT = 5;

/** Each group's clock, who is on it, and its latest picks. Empty before the start. */
export async function getDraftStatus(leagueId: string): Promise<GroupStatus[]> {
  const groups = await getDraftGroups(leagueId);
  if (groups.length === 0) return [];
  const supabase = createClient(await cookies());
  const { data: groupRows } = await supabase
    .from("draft_groups")
    .select("id, number")
    .eq("league_id", leagueId);
  const idByNumber = new Map(
    (groupRows ?? []).map((g) => [Number(g.number), String(g.id)]),
  );
  const { data: clocks } = await supabase
    .from("draft_clocks")
    .select("group_id, next_pick, total_picks, deadline, finished_at")
    .eq("league_id", leagueId);
  const clockByGroup = new Map(
    (clocks ?? []).map((c) => [String(c.group_id), c]),
  );

  return Promise.all(
    groups.map(async (group) => {
      const groupId = idByNumber.get(group.number) ?? "";
      const c = clockByGroup.get(groupId);
      const size = group.members.length;
      const pickNumber = Number(c?.next_pick ?? 1);
      const totalPicks = Number(c?.total_picks ?? size * 25);
      const finished = c ? c.finished_at !== null : false;
      const names = new Map(
        group.members.map((m) => [m.userId, m.displayName]),
      );
      const position =
        finished || size === 0 ? null : onClock(pickNumber, size).position;
      const member =
        position === null
          ? undefined
          : group.members.find((m) => m.position === position);
      const { data: picks } = await supabase
        .from("draft_picks")
        .select(
          "pick_number, round, user_id, auto, submissions!draft_picks_submission_fkey(text)",
        )
        .eq("group_id", groupId)
        .order("pick_number", { ascending: false })
        .limit(RECENT);
      return {
        number: group.number,
        memberIds: group.members.map((m) => m.userId),
        pickNumber,
        totalPicks,
        round: finished
          ? 25
          : onClock(Math.min(pickNumber, totalPicks), size || 1).round,
        onClock: member
          ? { userId: member.userId, displayName: member.displayName }
          : null,
        deadline:
          finished || !c?.deadline ? null : new Date(c.deadline).toISOString(),
        finished,
        recent: (picks ?? []).map((p) => {
          const square = Array.isArray(p.submissions)
            ? p.submissions[0]
            : p.submissions;
          return {
            pickNumber: Number(p.pick_number),
            round: Number(p.round),
            displayName: names.get(String(p.user_id)) ?? "Player",
            text: String((square as { text?: unknown } | null)?.text ?? ""),
            auto: p.auto === true,
          };
        }),
      };
    }),
  );
}
