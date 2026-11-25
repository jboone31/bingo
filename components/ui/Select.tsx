import { type ComponentPropsWithoutRef, useId } from "react";
import styles from "./Select.module.css";

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

type SelectProps = Omit<
  ComponentPropsWithoutRef<"select">,
  "className" | "style" | "id" | "children"
> & {
  label: string;
  options: readonly SelectOption[];
  placeholder?: string;
};

/** A labelled native select. */
export function Select({ label, options, placeholder, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select {...rest} id={id} className={styles.select}>
        {placeholder !== undefined ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
