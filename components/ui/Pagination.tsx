import Link from "next/link";
import styles from "./Pagination.module.css";

/** Previous and next links for `?page=N` lists. Renders nothing for one page. */
export function Pagination({
  basePath,
  page,
  pageCount,
  params,
}: {
  basePath: string;
  page: number;
  pageCount: number;
  /** Other query parameters to keep in every link, such as a filter. */
  params?: URLSearchParams;
}) {
  if (pageCount <= 1) return null;
  const href = (n: number) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (n > 1) next.set("page", String(n));
    const query = next.toString();
    return query === "" ? basePath : `${basePath}?${query}`;
  };
  return (
    <nav className={styles.nav} aria-label="Pagination">
      {page > 1 ? (
        <Link href={href(page - 1)} className={styles.link} rel="prev">
          Previous
        </Link>
      ) : (
        <span className={styles.disabled}>Previous</span>
      )}
      <span className={styles.status}>
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={styles.link} rel="next">
          Next
        </Link>
      ) : (
        <span className={styles.disabled}>Next</span>
      )}
    </nav>
  );
}
