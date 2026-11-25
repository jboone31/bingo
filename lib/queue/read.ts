import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { SubmissionRow } from "@/lib/pool/read";

/** Queue reads through the signed-in user's session. RLS limits them to the owner. */

const client = async () => createClient(await cookies());

/** The caller's queue in order, with each square's details. */
export async function getQueue(
  leagueId: string,
  userId: string,
): Promise<SubmissionRow[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("queue_items")
    .select(
      "position, submissions!queue_items_submission_fkey(id, text, submitter, category)",
    )
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .order("position", { ascending: true });
  const items: SubmissionRow[] = [];
  for (const row of data ?? []) {
    const submission = Array.isArray(row.submissions)
      ? row.submissions[0]
      : row.submissions;
    if (submission) items.push(submission as SubmissionRow);
  }
  return items;
}

/** Which of these submissions are in the caller's queue. */
export async function getQueuedIds(
  leagueId: string,
  userId: string,
  submissionIds: readonly string[],
): Promise<Set<string>> {
  if (submissionIds.length === 0) return new Set();
  const supabase = await client();
  const { data } = await supabase
    .from("queue_items")
    .select("submission_id")
    .eq("league_id", leagueId)
    .eq("user_id", userId)
    .in("submission_id", [...submissionIds]);
  return new Set((data ?? []).map((row) => String(row.submission_id)));
}

/** How many squares the caller has queued. */
export async function countQueue(
  leagueId: string,
  userId: string,
): Promise<number> {
  const supabase = await client();
  const { count } = await supabase
    .from("queue_items")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId)
    .eq("user_id", userId);
  return count ?? 0;
}
