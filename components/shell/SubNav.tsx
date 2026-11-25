"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SubNav.module.css";

export interface SubNavItem {
  readonly href: string;
  readonly label: string;
}

/**
 * Second-level navigation: tabs from 640px up, a fixed bottom bar on phones. The
 * current page is marked with `aria-current="page"`.
 */
export function SubNav({
  items,
  label,
}: {
  items: readonly SubNavItem[];
  label: string;
}) {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label={label}>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.href} className={styles.entry}>
            <Link
              href={item.href}
              className={styles.link}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
