"use client";
import { useEffect, useRef, useState } from "react";
import { EventFeed, type FeedSnapshot } from "@/lib/events/feed";
import { stateFromInitial } from "@/lib/events/fold";
import type { LeagueEvent } from "@/lib/events/types";
import { createClient } from "@/utils/supabase/client";
import { supabaseEventSource } from "./supabaseSource";

/** How often a visible tab re-reads, to catch a silently dropped connection. */
export const RECHECK_MS = 60_000;

/**
 * A league's events, kept current. `initial` is the server-loaded list and is read
 * once, on mount: a later server refresh must not reset what the feed already holds.
 * Returns events ascending by seq plus the connection state.
 */
export function useLeagueEvents(
  leagueId: string,
  initial: readonly LeagueEvent[],
): FeedSnapshot {
  const seed = useRef(initial);
  const [snapshot, setSnapshot] = useState<FeedSnapshot>(() => ({
    events: stateFromInitial(initial).events,
    connection: "connecting",
  }));

  useEffect(() => {
    const feed = new EventFeed(
      supabaseEventSource(createClient(), leagueId),
      seed.current,
      setSnapshot,
    );
    feed.start();

    const visible = () => document.visibilityState === "visible";
    const onVisibility = () => {
      if (visible()) feed.recheck();
    };
    const timer = setInterval(() => {
      if (visible()) feed.recheck();
    }, RECHECK_MS);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      feed.close();
    };
  }, [leagueId]);

  return snapshot;
}
