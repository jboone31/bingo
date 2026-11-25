import type { ReactNode } from "react";
import styles from "./layout.module.css";

/** Full-bleed, centered layout without the app shell. */
export default function SignInLayout({ children }: { children: ReactNode }) {
  return <div className={styles.screen}>{children}</div>;
}
