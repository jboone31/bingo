"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { reasonMessage } from "@/lib/leagues/messages";
import styles from "./ConfirmAction.module.css";

/** Where to go after the request succeeds: reload the page, or navigate. */
export type AfterAction = { kind: "refresh" } | { kind: "go"; to: string };

/**
 * A button that asks for confirmation, then sends one request to a league route.
 * Failures show the route's reason as a toast.
 */
export function ConfirmAction({
  label,
  variant = "secondary",
  size = "md",
  title,
  children,
  confirmLabel,
  request,
  after,
  successMessage,
  disabled = false,
  refreshOnError = false,
}: {
  label: string;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  request: { url: string; method: "POST" | "DELETE"; body?: unknown };
  after: AfterAction;
  successMessage?: string;
  disabled?: boolean;
  /** Reload the page's data after a refusal too, so it shows what changed. */
  refreshOnError?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      const res = await fetch(request.url, {
        method: request.method,
        headers: { "content-type": "application/json" },
        body:
          request.body === undefined ? undefined : JSON.stringify(request.body),
      });
      const data = (await res.json().catch(() => ({}))) as { reason?: unknown };
      if (!res.ok) {
        toast.show(reasonMessage(data.reason), "danger");
        setOpen(false);
        if (refreshOnError) router.refresh();
        return;
      }
      if (successMessage) toast.show(successMessage, "success");
      setOpen(false);
      if (after.kind === "go") {
        router.push(after.to);
      }
      router.refresh();
    } catch {
      toast.show(reasonMessage(undefined), "danger");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title}>
        {children}
        <div className={styles.actions}>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            loading={pending}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>
    </>
  );
}
