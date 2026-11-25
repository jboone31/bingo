import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.title}>{title}</h2>
      {message ? <p className={styles.message}>{message}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
