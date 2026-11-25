import { Button, ButtonLink } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import {
  SEARCH_MAX,
  SORT_KEYS,
  SORT_LABELS,
  categoryParam,
  isDefaultQuery,
  type PoolQuery,
} from "@/lib/pool/query";
import type { CategoryOption } from "@/lib/pool/read";
import styles from "./PoolFilterBar.module.css";

/**
 * Category, search and sort for the pool. A plain GET form, so it works without
 * client JavaScript and every result has a shareable URL. Submitting starts on page 1.
 * Takes its own `basePath`, so the draft room can reuse it.
 */
export function PoolFilterBar({
  basePath,
  query,
  categories,
}: {
  basePath: string;
  query: PoolQuery;
  categories: readonly CategoryOption[];
}) {
  const uncategorized = categories.find((c) => c.key === "");
  const named = categories.filter((c) => c.key !== "");
  return (
    <form method="get" action={basePath} className={styles.bar}>
      <Select
        label="Category"
        name="cat"
        defaultValue={categoryParam(query.category)}
        options={[
          { value: "", label: "All categories" },
          ...named.map((c) => ({
            value: `c:${c.key}`,
            label: `${c.label} (${c.count})`,
          })),
          ...(uncategorized
            ? [
                {
                  value: "none",
                  label: `Uncategorized (${uncategorized.count})`,
                },
              ]
            : []),
        ]}
      />
      <TextField
        label="Search"
        name="q"
        type="search"
        defaultValue={query.q}
        maxLength={SEARCH_MAX}
        autoComplete="off"
      />
      <Select
        label="Sort by"
        name="sort"
        defaultValue={query.sort}
        options={SORT_KEYS.map((key) => ({
          value: key,
          label: SORT_LABELS[key],
        }))}
      />
      <div className={styles.actions}>
        <Button type="submit">Apply</Button>
        {!isDefaultQuery(query) ? (
          <ButtonLink href={basePath} variant="ghost">
            Clear
          </ButtonLink>
        ) : null}
      </div>
    </form>
  );
}
