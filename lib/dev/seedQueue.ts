import "server-only";
import type { QueryRunner } from "@/lib/db/server";

/**
 * Give one member a queue holding `submissionIds` in that order. Used by the dev
 * scenarios. Goes through the real table, so the same triggers and limits apply.
 */
export async function insertSeedQueue(
  tx: QueryRunner,
  leagueId: string,
  userId: string,
  submissionIds: readonly string[],
): Promise<void> {
  if (submissionIds.length === 0) return;
  await tx.query(
    `insert into public.queue_items (league_id, user_id, submission_id, position)
     select $1, $2, t.submission_id, t.n
       from unnest($3::uuid[]) with ordinality as t(submission_id, n)`,
    [leagueId, userId, submissionIds],
  );
}
