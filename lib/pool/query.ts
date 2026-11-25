/**
 * The pool's filter, sort and search state, read from URL parameters. Pure and
 * client-safe. Anything unknown or malformed falls back to a default; parsing never
 * throws, so a hand-edited URL cannot break the page.
 *
 * `cat` missing or empty means all categories, `cat=none` means Uncategorized, and
 * `cat=c:sports` means that category, matched ignoring case. The `c:` prefix means a
 * real category name can never be mistaken for `none`, and a plain HTML form can
 * submit "All" as an empty value.
 */
export type CategoryFilter =
  { kind: "all" } | { kind: "none" } | { kind: "named"; key: string };

export const SORT_KEYS = ["added", "text", "submitter", "category"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export interface PoolQuery {
  readonly category: CategoryFilter;
  readonly q: string;
  readonly sort: SortKey;
}

export const SEARCH_MAX = 100;
const CATEGORY_KEY_MAX = 40;

export const DEFAULT_QUERY: PoolQuery = {
  category: { kind: "all" },
  q: "",
  sort: "added",
};

export const SORT_LABELS: Record<SortKey, string> = {
  added: "Order added",
  text: "Text",
  submitter: "Submitter",
  category: "Category",
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Trim, collapse whitespace, lowercase: the form a category key is compared in. */
export function categoryKey(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Parse `cat`, `q` and `sort` from search params. Never throws. */
export function parsePoolQuery(raw: RawParams): PoolQuery {
  const cat = first(raw.cat) ?? "";
  let category: CategoryFilter = { kind: "all" };
  if (cat === "none") {
    category = { kind: "none" };
  } else if (cat.startsWith("c:")) {
    const key = [...categoryKey(cat.slice(2))]
      .slice(0, CATEGORY_KEY_MAX)
      .join("");
    if (key !== "") category = { kind: "named", key };
  }
  const q = [...(first(raw.q) ?? "").trim()].slice(0, SEARCH_MAX).join("");
  const sortRaw = first(raw.sort);
  const sort = SORT_KEYS.find((key) => key === sortRaw) ?? DEFAULT_QUERY.sort;
  return { category, q, sort };
}

/** URL parameters for a query, omitting defaults so links stay short. */
export function poolQueryToParams(
  query: PoolQuery,
  page?: number,
): URLSearchParams {
  const params = new URLSearchParams();
  if (query.category.kind === "none") params.set("cat", "none");
  if (query.category.kind === "named") {
    params.set("cat", `c:${query.category.key}`);
  }
  if (query.q !== "") params.set("q", query.q);
  if (query.sort !== DEFAULT_QUERY.sort) params.set("sort", query.sort);
  if (page !== undefined && page > 1) params.set("page", String(page));
  return params;
}

/** The `cat` value for a form option. Empty means all categories. */
export function categoryParam(category: CategoryFilter): string {
  if (category.kind === "none") return "none";
  if (category.kind === "named") return `c:${category.key}`;
  return "";
}

/** True when the query narrows or reorders nothing. */
export function isDefaultQuery(query: PoolQuery): boolean {
  return poolQueryToParams(query).size === 0;
}

/**
 * An `ilike` pattern that matches `term` as a literal substring: `\`, `%` and `_` are
 * escaped, and `*` (which PostgREST treats as a wildcard) is removed.
 */
export function searchPattern(term: string): string {
  const literal = term.replace(/\*/g, "").replace(/[\\%_]/g, "\\$&");
  return `%${literal}%`;
}

/** An `ilike` pattern that matches `value` exactly (ignoring case). */
export function exactPattern(value: string): string {
  return value.replace(/\*/g, "").replace(/[\\%_]/g, "\\$&");
}

/** Short descriptions of the active filters, for "No squares match ...". */
export function describeFilter(query: PoolQuery): string[] {
  const parts: string[] = [];
  if (query.category.kind === "none") parts.push("category: Uncategorized");
  if (query.category.kind === "named") {
    parts.push(`category: ${query.category.key}`);
  }
  if (query.q !== "") parts.push(`text contains "${query.q}"`);
  return parts;
}
