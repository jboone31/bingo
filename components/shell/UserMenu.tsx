"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import styles from "./UserMenu.module.css";

/** Display name button that opens Profile and Sign out. */
export function UserMenu({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={root}>
      <button
        ref={button}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {displayName}
      </button>
      {open ? (
        <div id={menuId} className={styles.menu}>
          <Link
            href="/profile"
            className={styles.item}
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <form method="post" action="/api/auth/sign-out">
            <button type="submit" className={styles.item}>
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
