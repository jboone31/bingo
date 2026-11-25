import { type ComponentPropsWithoutRef, useId } from "react";
import { cx } from "./cx";
import styles from "./TextField.module.css";

type TextFieldProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "className" | "style" | "id"
> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        {...rest}
        id={id}
        className={cx(styles.input, error && styles.invalid)}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      />
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
