import type { ReactNode } from "react";
import styles from "./PageContainer.module.css";

/** Centered, width-limited page body with responsive padding. */
export function PageContainer({ children }: { children: ReactNode }) {
  return <main className={styles.container}>{children}</main>;
}
