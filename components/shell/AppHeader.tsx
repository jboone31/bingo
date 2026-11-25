import Link from "next/link";
import { DevBanner } from "@/components/dev/DevBanner";
import styles from "./AppHeader.module.css";
import { UserMenu } from "./UserMenu";

export function AppHeader({
  displayName,
  devActingAs = null,
}: {
  displayName: string | null;
  /** Set only while a seed player's session is active (dev tools). */
  devActingAs?: string | null;
}) {
  return (
    <header className={styles.header}>
      {devActingAs !== null ? <DevBanner name={devActingAs} /> : null}
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          Bingo Draft
        </Link>
        {displayName !== null ? <UserMenu displayName={displayName} /> : null}
      </div>
    </header>
  );
}
