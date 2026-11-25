import { type ReactNode, useId } from "react";
import styles from "./Panel.module.css";

export function Panel({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section
      className={styles.panel}
      aria-labelledby={title ? titleId : undefined}
    >
      {title ? (
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
      ) : null}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
