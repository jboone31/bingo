import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { LeagueStatus, MemberRole } from "./types";

/**
 * League reads through the signed-in user's session, so RLS decides what is
 * visible. Non-members get nothing back.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LeagueSummary {
  readonly id: string;
  readonly name: string;
  readonly status: LeagueStatus;
  readonly draftAt: string | null;
  readonly memberCount: number;
  readonly role: MemberRole;
}

export interface LeagueDetail {
  readonly id: string;
  readonly name: string;
  readonly status: LeagueStatus;
  readonly draftAt: string | null;
  readonly joinCode: string;
  readonly groupCount: number;
  readonly pickSeconds: number;
  readonly draftStartedAt: string | null;
}

export interface MemberInfo {
  readonly userId: string;
  readonly displayName: string;
  readonly role: MemberRole;
}

const client = async () => createClient(await cookies());

/** Every league the user belongs to, newest first. */
export async function listMyLeagues(userId: string): Promise<LeagueSummary[]> {
  const supabase = await client();
  const { data: leagues } = await supabase
    .from("leagues")
    .select("id, name, status, draft_at, league_members(count)")
    .order("created_at", { ascending: false });
  const { data: mine } = await supabase
    .from("league_members")
    .select("league_id, role")
    .eq("user_id", userId);
  const roles = new Map((mine ?? []).map((m) => [m.league_id, m.role]));
  return (leagues ?? []).map((l) => ({
    id: l.id,
    name: l.name,
    status: l.status as LeagueStatus,
    draftAt: l.draft_at,
    memberCount: l.league_members?.[0]?.count ?? 0,
    role: (roles.get(l.id) ?? "member") as MemberRole,
  }));
}

/** One league, or `null` if it does not exist or the user is not a member. */
export const getLeague = cache(
  async (id: string): Promise<LeagueDetail | null> => {
    if (!UUID.test(id)) return null;
    const supabase = await client();
    const { data } = await supabase
      .from("leagues")
      .select(
        "id, name, status, draft_at, join_code, group_count, pick_seconds, draft_started_at",
      )
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      status: data.status as LeagueStatus,
      draftAt: data.draft_at,
      joinCode: data.join_code,
      groupCount: data.group_count ?? 1,
      pickSeconds: data.pick_seconds ?? 60,
      draftStartedAt: data.draft_started_at ?? null,
    };
  },
);

/** Members with display names, admin first, then by join time. */
export const listMembers = cache(
  async (leagueId: string): Promise<MemberInfo[]> => {
    if (!UUID.test(leagueId)) return [];
    const supabase = await client();
    const { data } = await supabase
      .from("league_members")
      .select("user_id, role, created_at, profiles(display_name)")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: true });
    const members = (data ?? []).map((m) => {
      const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
      return {
        userId: m.user_id,
        displayName: profile?.display_name ?? "Player",
        role: m.role as MemberRole,
      };
    });
    return members.sort(
      (a, b) => Number(b.role === "admin") - Number(a.role === "admin"),
    );
  },
);
