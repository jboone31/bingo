import Link from "next/link";
import styles from "./Pagination.module.css";

/** Previous and next links for `?page=N` lists. Renders nothing for one page. */
export function Pagination({
  basePath,
  page,
  pageCount,
}: {
  basePath: string;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (n: number) => (n === 1 ? basePath : `${basePath}?page=${n}`);
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
