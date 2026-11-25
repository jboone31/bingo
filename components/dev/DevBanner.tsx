import Link from "next/link";
import styles from "./DevBanner.module.css";

/** Shown while a seed player's session is active. Dev tools only. */
export function DevBanner({ name }: { name: string }) {
  return (
    <div className={styles.banner} role="status">
      <span>Dev: acting as {name}</span>
      <Link href="/dev" className={styles.link}>
        Dev tools
      </Link>
    </div>
  );
}
