// @vitest-environment jsdom
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow } from "@/lib/events/rows";
import type { LeagueEvent } from "@/lib/events/types";

const m = vi.hoisted(() => ({
  insert: null as null | ((payload: { new: unknown }) => void),
  status: null as null | ((s: string) => void),
  filter: null as unknown,
  channelName: null as string | null,
  removeChannel: vi.fn(),
  gt: vi.fn(),
  rows: [] as unknown[],
}));

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    channel: (name: string) => {
      m.channelName = name;
      const channel = {
        on: (
          _t: string,
          filter: unknown,
          cb: (p: { new: unknown }) => void,
        ) => {
          m.filter = filter;
          m.insert = cb;
          return channel;
        },
        subscribe: (cb: (s: string) => void) => {
          m.status = cb;
          return channel;
        },
      };
      return channel;
    },
    removeChannel: m.removeChannel,
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        gt: (_c: string, v: number) => {
          m.gt(v);
          return query;
        },
        order: () => query,
        limit: async () => ({ data: m.rows, error: null }),
      };
      return query;
    },
  }),
}));

import { ServerClockProvider, useServerNow } from "./ServerClockProvider";
import { RECHECK_MS, useLeagueEvents } from "./useLeagueEvents";

const row = (seq: number): EventRow => ({
  id: `id-${seq}`,
  league_id: "L1",
  seq,
  type: "pool_changed",
  payload: {},
  actor_id: null,
  created_at: "2026-01-01T00:00:00Z",
});
const ev = (seq: number): LeagueEvent => ({
  id: `id-${seq}`,
  leagueId: "L1",
  seq,
  type: "pool_changed",
  payload: {},
  actorId: null,
  createdAt: "2026-01-01T00:00:00Z",
});
const flush = () => act(async () => {});

beforeEach(() => {
  m.insert = m.status = null;
  m.removeChannel.mockReset();
  m.gt.mockReset();
  m.rows = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useLeagueEvents", () => {
  it("subscribes to inserts for the league and starts from the initial events", () => {
    const { result } = renderHook(() => useLeagueEvents("L1", [ev(2), ev(1)]));
    expect(m.channelName).toBe("league:L1:events");
    expect(m.filter).toEqual({
      event: "INSERT",
      schema: "public",
      table: "league_events",
      filter: "league_id=eq.L1",
    });
    expect(result.current.events.map((e) => e.seq)).toEqual([1, 2]);
    expect(result.current.connection).toBe("connecting");
  });

  it("adds a live event once", async () => {
    const { result } = renderHook(() => useLeagueEvents("L1", [ev(1)]));
    act(() => m.insert?.({ new: row(2) }));
    act(() => m.insert?.({ new: row(2) }));
    await flush();
    expect(result.current.events.map((e) => e.seq)).toEqual([1, 2]);
  });

  it("reads what it missed when the channel subscribes", async () => {
    m.rows = [row(2), row(3)];
    const { result } = renderHook(() => useLeagueEvents("L1", [ev(1)]));
    act(() => m.status?.("SUBSCRIBED"));
    await flush();
    expect(m.gt).toHaveBeenCalledWith(1);
    expect(result.current.events.map((e) => e.seq)).toEqual([1, 2, 3]);
    expect(result.current.connection).toBe("live");
  });

  it("shows offline when the channel errors", () => {
    const { result } = renderHook(() => useLeagueEvents("L1", []));
    act(() => m.status?.("CHANNEL_ERROR"));
    expect(result.current.connection).toBe("offline");
  });

  it("re-reads when the tab becomes visible, and on the quiet-period timer", async () => {
    vi.useFakeTimers();
    renderHook(() => useLeagueEvents("L1", [ev(1)]));
    expect(m.gt).not.toHaveBeenCalled();
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(m.gt).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECHECK_MS);
    });
    expect(m.gt).toHaveBeenCalledTimes(2);
  });

  it("closes the channel on unmount and ignores a later server refresh of initial", () => {
    const { result, rerender, unmount } = renderHook(
      ({ initial }) => useLeagueEvents("L1", initial),
      { initialProps: { initial: [ev(1)] } },
    );
    rerender({ initial: [ev(1), ev(2), ev(3)] });
    expect(result.current.events.map((e) => e.seq)).toEqual([1]);
    unmount();
    expect(m.removeChannel).toHaveBeenCalledTimes(1);
  });
});

describe("ServerClockProvider", () => {
  let serverNow: () => number = () => 0;
  function Capture() {
    serverNow = useServerNow();
    return null;
  }
  const mountAndWait = async () => {
    render(
      <ServerClockProvider>
        <Capture />
      </ServerClockProvider>,
    );
    // Three samples, 400 ms apart.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1500));
    });
  };

  it("moves the clock by the measured offset", async () => {
    const OFFSET = 60_000;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, now: Date.now() + OFFSET }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    await mountAndWait();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(Math.abs(serverNow() - Date.now() - OFFSET)).toBeLessThan(500);
    vi.unstubAllGlobals();
  });

  it("falls back to the client clock when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    await mountAndWait();
    expect(Math.abs(serverNow() - Date.now())).toBeLessThan(500);
    vi.unstubAllGlobals();
  });
});
