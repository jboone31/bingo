import "server-only";
import type { QueryRunner } from "@/lib/db/server";
import type { GroupPlan } from "./split";

/** SQL for draft settings and the start. Callers hold the league row lock. */

/** Save the given settings. Returns whether either value changed. */
export async function setDraftSettings(
  tx: QueryRunner,
  leagueId: string,
  settings: { groupCount?: number; pickSeconds?: number },
): Promise<boolean> {
  const { rows } = await tx.query(
    `update public.leagues
        set group_count = coalesce($2::int, group_count),
            pick_seconds = coalesce($3::int, pick_seconds)
      where id = $1
        and (group_count is distinct from coalesce($2::int, group_count)
             or pick_seconds is distinct from coalesce($3::int, pick_seconds))
      returning id`,
    [leagueId, settings.groupCount ?? null, settings.pickSeconds ?? null],
  );
  return rows.length > 0;
}

/** Every member's user id, in a stable order (the shuffle makes the order). */
export async function listMemberIds(
  tx: QueryRunner,
  leagueId: string,
): Promise<string[]> {
  const { rows } = await tx.query(
    `select user_id from public.league_members where league_id = $1
      order by created_at, user_id`,
    [leagueId],
  );
  return rows.map((r) => String(r.user_id));
}

/** Move the league to drafting, stamped with the database clock. */
export async function markStarted(
  tx: QueryRunner,
  leagueId: string,
): Promise<string> {
  const { rows } = await tx.query(
    `update public.leagues
        set status = 'drafting', draft_started_at = now()
      where id = $1 and status = 'pre_draft'
      returning draft_started_at`,
    [leagueId],
  );
  if (!rows[0]) throw new Error("league was not pre_draft");
  return new Date(rows[0].draft_started_at as string | Date).toISOString();
}

/** Write the groups and their orders. Two statements, whatever the size. */
export async function insertGroups(
  tx: QueryRunner,
  leagueId: string,
  plan: readonly GroupPlan[],
): Promise<void> {
  const { rows } = await tx.query(
    `insert into public.draft_groups (league_id, number)
     select $1, n from unnest($2::int[]) as n
     returning id, number`,
    [leagueId, plan.map((g) => g.number)],
  );
  const idByNumber = new Map(rows.map((r) => [Number(r.number), String(r.id)]));
  const members = plan.flatMap((g) =>
    g.members.map((m) => ({ groupId: idByNumber.get(g.number)!, ...m })),
  );
  await tx.query(
    `insert into public.draft_group_members (league_id, group_id, user_id, position)
     select $1, t.group_id, t.user_id, t.position
       from unnest($2::uuid[], $3::uuid[], $4::int[]) as t(group_id, user_id, position)`,
    [
      leagueId,
      members.map((m) => m.groupId),
      members.map((m) => m.userId),
      members.map((m) => m.position),
    ],
  );
}
