import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { clampPage, pageCountFor, rangeFor } from "./paging";

/** Pool reads through the signed-in user's session, so RLS decides visibility. */

const client = async () => createClient(await cookies());

export interface SubmissionRow {
  readonly id: string;
  readonly text: string;
  readonly submitter: string;
  readonly category: string;
}

export interface PoolPage {
  readonly items: SubmissionRow[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

/** How many submissions the league has. Zero if the caller cannot see the league. */
export const countPool = cache(async (leagueId: string): Promise<number> => {
  const supabase = await client();
  const { count } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq("league_id", leagueId);
  return count ?? 0;
});

/** One page of the pool in the order rows were added. `rawPage` is the `?page=` value. */
export async function getPoolPage(
  leagueId: string,
  rawPage: unknown,
): Promise<PoolPage> {
  const total = await countPool(leagueId);
  const pageCount = pageCountFor(total);
  const page = clampPage(rawPage, pageCount);
  const { from, to } = rangeFor(page);
  const supabase = await client();
  const { data } = await supabase
    .from("submissions")
    .select("id, text, submitter, category")
    .eq("league_id", leagueId)
    .order("seq", { ascending: true })
    .range(from, to);
  return { items: data ?? [], total, page, pageCount };
}
