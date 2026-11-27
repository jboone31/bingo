"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useServerNow } from "@/components/realtime/ServerClockProvider";
import styles from "./DraftSetup.module.css";

/** How often the display updates. */
export const TICK_MS = 250;
/** Nudges wait a random 0 to this many ms after a deadline, so clients spread out. */
export const NUDGE_JITTER_MS = 1000;

/** `m:ss` for a number of milliseconds left (never negative). */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Time left until `deadline`, in server time. When it reaches zero, this tab asks the
 * server to settle the league once (after a random pause), then reloads the page's
 * data. The server render shows a placeholder, so hydration always matches.
 */
export function Countdown({
  leagueId,
  deadline,
}: {
  leagueId: string;
  deadline: string;
}) {
  const router = useRouter();
  const serverNow = useServerNow();
  const [left, setLeft] = useState<number | null>(null);
  const nudged = useRef<string | null>(null);
  const due = new Date(deadline).getTime();

  useEffect(() => {
    const tick = () => setLeft(due - serverNow());
    tick();
    const timer = setInterval(tick, TICK_MS);
    return () => clearInterval(timer);
  }, [due, serverNow]);

  // The pending nudge lives in a ref: the display ticks every 250 ms, and an effect
  // cleanup on each tick would cancel a nudge whose random pause is longer than that.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (left === null || left > 0 || nudged.current === deadline) return;
    nudged.current = deadline;
    pending.current = setTimeout(() => {
      pending.current = null;
      void fetch(`/api/leagues/${leagueId}/draft/settle`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
        .catch(() => undefined)
        .finally(() => router.refresh());
    }, Math.random() * NUDGE_JITTER_MS);
  }, [left, deadline, leagueId, router]);
  useEffect(
    () => () => {
      if (pending.current !== null) clearTimeout(pending.current);
    },
    [],
  );

  return (
    <span className={styles.countdown} role="timer" aria-live="off">
      {left === null ? "-:--" : formatRemaining(left)}
    </span>
  );
}
