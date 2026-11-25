import Link from "next/link";
import styles from "./AppHeader.module.css";
import { UserMenu } from "./UserMenu";

export function AppHeader({ displayName }: { displayName: string | null }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          Bingo Draft
        </Link>
        {displayName !== null ? <UserMenu displayName={displayName} /> : null}
      </div>
    </header>
  );
}
