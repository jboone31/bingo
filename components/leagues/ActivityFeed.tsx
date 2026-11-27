"use client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import { LocalTime } from "@/components/LocalTime";
import { useLeagueEvents } from "@/components/realtime/useLeagueEvents";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { describeEvent } from "@/lib/events/describe";
import { RECENT_EVENTS, type LeagueEvent } from "@/lib/events/types";
import styles from "./ActivityFeed.module.css";

/** How long to wait for more events before re-reading the page's server data. */
export const REFRESH_DEBOUNCE_MS = 300;

const CONNECTION = {
  connecting: { tone: "neutral", label: "Connecting" },
  live: { tone: "success", label: "Live" },
  offline: { tone: "danger", label: "Reconnecting" },
} as const;

/**
 * The league's recent activity, newest first. New events arrive without a reload, and
 * each one also refreshes the page's server-rendered data (players, pool size, draft
 * date), debounced so a burst causes one refresh. `initial` is newest first, as the
 * server loads it.
 */
export function ActivityFeed({
  leagueId,
  initial,
}: {
  leagueId: string;
  initial: readonly LeagueEvent[];
}) {
  const router = useRouter();
  const { events, connection } = useLeagueEvents(leagueId, initial);
  const newest = events.length > 0 ? events[events.length - 1].seq : 0;

  // The page already shows the state as of its own render; only later events refresh.
  const seen = useRef(newest);
  useEffect(() => {
    if (newest <= seen.current) return;
    const timer = setTimeout(() => {
      seen.current = newest;
      router.refresh();
    }, REFRESH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [newest, router]);

  const shown = useMemo(
    () => [...events].reverse().slice(0, RECENT_EVENTS),
    [events],
  );
  const status = CONNECTION[connection];

  return (
    <div className={styles.feed}>
      <p className={styles.status}>
        <Badge tone={status.tone}>{status.label}</Badge>
      </p>
      {shown.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          message="Joins, changes to the pool and other league news show up here."
        />
      ) : (
        <ol className={styles.list}>
          {shown.map((event) => (
            <li key={event.seq} className={styles.item}>
              <span className={styles.text}>{describeEvent(event)}</span>
              <span className={styles.time}>
                <LocalTime iso={event.createdAt} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
