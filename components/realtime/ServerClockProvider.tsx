"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { bestEstimate, type ClockSample } from "@/lib/time/clockOffset";

const SAMPLES = 3;
const SAMPLE_GAP_MS = 400;

/** The client clock, as wall milliseconds, steady across a sample. */
const anchor = { wall: Date.now(), perf: 0 };
if (typeof performance !== "undefined") anchor.perf = performance.now();
const clientNow = (): number =>
  typeof performance === "undefined"
    ? Date.now()
    : anchor.wall + (performance.now() - anchor.perf);

async function takeSample(): Promise<ClockSample | null> {
  const sentAt = clientNow();
  try {
    const response = await fetch("/api/time", { cache: "no-store" });
    const receivedAt = clientNow();
    if (!response.ok) return null;
    const body = (await response.json()) as { now?: unknown };
    if (typeof body.now !== "number") return null;
    return { sentAt, receivedAt, serverNow: body.now };
  } catch {
    return null;
  }
}

const ServerClockContext = createContext<() => number>(() => Date.now());

/**
 * Keeps an estimate of the server clock and offers it as `useServerNow()`. It
 * samples a few times on mount and again when the tab becomes visible or the
 * browser comes back online, keeping the sample with the shortest round trip.
 * Until the first sample the value is the client clock.
 */
export function ServerClockProvider({ children }: { children: ReactNode }) {
  const offset = useRef(0);

  const measure = useCallback(async (signal: { cancelled: boolean }) => {
    const samples: ClockSample[] = [];
    for (let i = 0; i < SAMPLES && !signal.cancelled; i += 1) {
      const sample = await takeSample();
      if (sample) samples.push(sample);
      if (i < SAMPLES - 1) {
        await new Promise((r) => setTimeout(r, SAMPLE_GAP_MS));
      }
    }
    const best = bestEstimate(samples);
    if (best && !signal.cancelled) offset.current = best.offsetMs;
  }, []);

  useEffect(() => {
    const signal = { cancelled: false };
    void measure(signal);
    const again = () => {
      if (document.visibilityState === "visible") void measure(signal);
    };
    const online = () => void measure(signal);
    document.addEventListener("visibilitychange", again);
    window.addEventListener("online", online);
    return () => {
      signal.cancelled = true;
      document.removeEventListener("visibilitychange", again);
      window.removeEventListener("online", online);
    };
  }, [measure]);

  const serverNow = useMemo(() => () => clientNow() + offset.current, []);
  return (
    <ServerClockContext.Provider value={serverNow}>
      {children}
    </ServerClockContext.Provider>
  );
}

/** Returns `serverNow()`: the estimated server time in milliseconds. */
export function useServerNow(): () => number {
  return useContext(ServerClockContext);
}
