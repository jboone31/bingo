import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import styles from "./Button.module.css";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface LookProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const look = (variant: ButtonVariant, size: ButtonSize) =>
  cx(styles.button, styles[variant], styles[size]);

type ButtonProps = LookProps &
  Omit<ComponentPropsWithoutRef<"button">, "className" | "style"> & {
    loading?: boolean;
  };

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={look(variant, size)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {children}
    </button>
  );
}

type ButtonLinkProps = LookProps & {
  href: string;
  children: ReactNode;
};

export function ButtonLink({
  variant = "primary",
  size = "md",
  href,
  children,
}: ButtonLinkProps) {
  return (
    <Link href={href} className={look(variant, size)}>
      {children}
    </Link>
  );
}
