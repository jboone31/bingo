import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { clampPage, pageCountFor, rangeFor } from "./paging";
import { exactPattern, searchPattern, type PoolQuery } from "./query";

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
  /** Rows matching the filter. */
  readonly total: number;
  /** Rows in the whole pool. */
  readonly poolTotal: number;
  readonly page: number;
  readonly pageCount: number;
}

export interface CategoryOption {
  readonly key: string;
  readonly label: string;
  readonly count: number;
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

/** Apply the category and search filters. Values are bound by the API, never joined in. */
function applyFilters<
  T extends {
    eq(column: string, value: string): T;
    ilike(column: string, pattern: string): T;
  },
>(builder: T, query: PoolQuery): T {
  let next = builder;
  if (query.category.kind === "none") {
    next = next.eq("category", "");
  } else if (query.category.kind === "named") {
    next = next.ilike("category", exactPattern(query.category.key));
  }
  if (query.q !== "") {
    next = next.ilike("text", searchPattern(query.q));
  }
  return next;
}

/**
 * One page of the pool, filtered and sorted. Ties always fall back to the order the
 * rows were added, so paging is stable. `rawPage` is the `?page=` value.
 */
export async function getPoolPage(
  leagueId: string,
  query: PoolQuery,
  rawPage: unknown,
): Promise<PoolPage> {
  const supabase = await client();
  const poolTotal = await countPool(leagueId);

  const counted = applyFilters(
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("league_id", leagueId) as never,
    query,
  ) as unknown as PromiseLike<{ count: number | null }>;
  const total = (await counted).count ?? 0;

  const pageCount = pageCountFor(total);
  const page = clampPage(rawPage, pageCount);
  const { from, to } = rangeFor(page);

  let select = applyFilters(
    supabase
      .from("submissions")
      .select("id, text, submitter, category")
      .eq("league_id", leagueId) as never,
    query,
  ) as unknown as ReturnType<
    ReturnType<typeof supabase.from<"submissions", never>>["select"]
  >;
  if (query.sort !== "added") {
    select = select.order(query.sort, { ascending: true });
  }
  const { data } = (await select
    .order("seq", { ascending: true })
    .range(from, to)) as unknown as { data: SubmissionRow[] | null };
  return { items: data ?? [], total, poolTotal, page, pageCount };
}

/** Distinct categories (ignoring case) with counts, for the filter. */
export async function listCategories(
  leagueId: string,
): Promise<CategoryOption[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("pool_categories")
    .select("key, label, count")
    .eq("league_id", leagueId)
    .order("label", { ascending: true });
  return (data ?? []).map((row) => ({
    key: String(row.key),
    label: String(row.label),
    count: Number(row.count),
  }));
}
