// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedSnapshot } from "@/lib/events/feed";
import type { LeagueEvent } from "@/lib/events/types";

const m = vi.hoisted(() => ({
  refresh: vi.fn(),
  snapshot: { events: [], connection: "live" } as {
    events: readonly unknown[];
    connection: string;
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: m.refresh }),
}));
vi.mock("@/components/realtime/useLeagueEvents", () => ({
  useLeagueEvents: () => m.snapshot,
}));

import { ActivityFeed, REFRESH_DEBOUNCE_MS } from "./ActivityFeed";

const ev = (
  seq: number,
  type: string,
  payload: Record<string, unknown> = {},
): LeagueEvent => ({
  id: `id-${seq}`,
  leagueId: "L1",
  seq,
  type,
  payload,
  actorId: null,
  createdAt: "2026-03-01T19:00:00.000Z",
});
const set = (events: LeagueEvent[], connection = "live") => {
  m.snapshot = { events, connection } as FeedSnapshot;
};
const ui = () => <ActivityFeed leagueId="L1" initial={[]} />;

beforeEach(() => {
  vi.useFakeTimers();
  m.refresh.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ActivityFeed", () => {
  it("lists events newest first as sentences", () => {
    set([
      ev(1, "member_joined", { name: "Sam" }),
      ev(2, "pool_changed", { kind: "imported", count: 12 }),
    ]);
    render(ui());
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("12 squares imported into the pool");
    expect(items[1]).toHaveTextContent("Sam joined the league");
  });

  it("shows only the latest 50", () => {
    set(
      Array.from({ length: 70 }, (_, i) => ev(i + 1, "join_code_regenerated")),
    );
    render(ui());
    expect(screen.getAllByRole("listitem")).toHaveLength(50);
  });

  it("shows an unknown type generically", () => {
    set([ev(1, "draft_pick")]);
    render(ui());
    expect(screen.getByText("Something changed")).toBeInTheDocument();
  });

  it("shows an empty state for an empty log", () => {
    set([]);
    render(ui());
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("shows the connection state", () => {
    set([], "offline");
    render(ui());
    expect(screen.getByText("Reconnecting")).toBeInTheDocument();
  });

  it("does not refresh the page for the events it started with", () => {
    set([ev(1, "member_joined", { name: "Sam" })]);
    render(ui());
    act(() => vi.advanceTimersByTime(REFRESH_DEBOUNCE_MS * 5));
    expect(m.refresh).not.toHaveBeenCalled();
  });

  it("refreshes once, after a pause, when a new event arrives", () => {
    set([ev(1, "member_joined", { name: "Sam" })]);
    const { rerender } = render(ui());
    set([
      ev(1, "member_joined", { name: "Sam" }),
      ev(2, "member_joined", { name: "Alex" }),
    ]);
    rerender(ui());
    expect(m.refresh).not.toHaveBeenCalled();
    set([
      ev(1, "member_joined", { name: "Sam" }),
      ev(2, "member_joined", { name: "Alex" }),
      ev(3, "member_left", { name: "Alex" }),
    ]);
    rerender(ui());
    act(() => vi.advanceTimersByTime(REFRESH_DEBOUNCE_MS));
    expect(m.refresh).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(REFRESH_DEBOUNCE_MS * 5));
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});
