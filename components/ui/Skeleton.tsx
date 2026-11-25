import styles from "./Skeleton.module.css";

/** Placeholder block. Sized by the parent; hidden from assistive tech. */
export function Skeleton({ lines = 1 }: { lines?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={styles.line} />
      ))}
    </div>
  );
}
