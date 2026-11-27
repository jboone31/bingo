import "server-only";
import type { QueryRunner } from "@/lib/db/server";
import type { LeagueStatus } from "@/lib/leagues/types";

/** All SQL for queues. Every call here runs inside a transaction that holds the lock. */

/**
 * Lock the caller's own membership row (so one player's queue writes run one at a
 * time) and hold the league row for share (so the draft start, which locks it for
 * update, cannot interleave). Returns the league status, or `null` when the league
 * does not exist or the caller is not a member.
 */
export async function lockMemberForQueue(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
): Promise<LeagueStatus | null> {
  const { rows } = await tx.query(
    `select l.status
       from public.leagues l
       join public.league_members m on m.league_id = l.id
      where l.id = $1 and m.user_id = $2
        for share of l
        for update of m`,
    [leagueId, userId],
  );
  return rows[0] ? (rows[0].status as LeagueStatus) : null;
}

export async function submissionInLeague(
  tx: QueryRunner,
  leagueId: string,
  submissionId: string,
): Promise<boolean> {
  const { rows } = await tx.query(
    `select 1 from public.submissions where id = $1 and league_id = $2`,
    [submissionId, leagueId],
  );
  return rows.length > 0;
}

/** The member's queued submission ids, in queue order. */
export async function getQueueIds(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
): Promise<string[]> {
  const { rows } = await tx.query(
    `select submission_id from public.queue_items
      where league_id = $1 and user_id = $2
      order by position`,
    [leagueId, userId],
  );
  return rows.map((r) => String(r.submission_id));
}

/** Add to the end of the queue. Returns false if it was already queued. */
export async function insertQueueItem(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
  submissionId: string,
): Promise<boolean> {
  const { rows } = await tx.query(
    `insert into public.queue_items (league_id, user_id, submission_id, position)
     select $1, $2, $3, coalesce(max(position), 0) + 1
       from public.queue_items
      where league_id = $1 and user_id = $2
     on conflict (league_id, user_id, submission_id) do nothing
     returning id`,
    [leagueId, userId, submissionId],
  );
  return rows.length > 0;
}

export async function deleteQueueItem(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
  submissionId: string,
): Promise<void> {
  await tx.query(
    `delete from public.queue_items
      where league_id = $1 and user_id = $2 and submission_id = $3`,
    [leagueId, userId, submissionId],
  );
}

/**
 * Rewrite every position to match `ids` (1, 2, 3, ...). The caller has already
 * checked `ids` is exactly the current queue. The position uniqueness check is
 * deferred, so this is one statement.
 */
export async function rewriteOrder(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
  ids: readonly string[],
): Promise<void> {
  if (ids.length === 0) return;
  await tx.query(
    `update public.queue_items q
        set position = t.n
       from unnest($3::uuid[]) with ordinality as t(submission_id, n)
      where q.league_id = $1 and q.user_id = $2
        and q.submission_id = t.submission_id`,
    [leagueId, userId, ids],
  );
}

/** Whether the square has been drafted in the caller's group (always false before the start). */
export async function pickedInMyGroup(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
  submissionId: string,
): Promise<boolean> {
  const { rows } = await tx.query(
    `select 1
       from public.draft_picks p
       join public.draft_group_members m on m.group_id = p.group_id
      where p.league_id = $1 and m.user_id = $2 and p.submission_id = $3`,
    [leagueId, userId, submissionId],
  );
  return rows.length > 0;
}
