import { Button } from "./Button";
import styles from "./ErrorState.module.css";

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.error} role="alert">
      <h2 className={styles.title}>{title}</h2>
      {message ? <p className={styles.message}>{message}</p> : null}
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
