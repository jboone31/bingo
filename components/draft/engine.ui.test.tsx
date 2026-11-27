// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DevDraftPanel } from "@/components/dev/DevDraftPanel";
import { ToastProvider } from "@/components/ui/Toast";
import type { GroupStatus } from "@/lib/draft/read";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { Countdown, NUDGE_JITTER_MS, formatRemaining } from "./Countdown";
import { DraftStatus } from "./DraftStatus";

const reply = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ picks: 1 }),
  });

beforeEach(() => refresh.mockReset());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("formatRemaining", () => {
  it("rounds up to whole seconds and never goes negative", () => {
    expect(formatRemaining(59_001)).toBe("1:00");
    expect(formatRemaining(61_000)).toBe("1:01");
    expect(formatRemaining(500)).toBe("0:01");
    expect(formatRemaining(0)).toBe("0:00");
    expect(formatRemaining(-5000)).toBe("0:00");
  });
});

describe("Countdown", () => {
  it("still nudges when the random pause is longer than a tick", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T19:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const fetchMock = reply();
    vi.stubGlobal("fetch", fetchMock);
    render(<Countdown leagueId="L1" deadline="2026-03-01T19:00:00.500Z" />);
    // Step tick by tick, as a browser renders, so each tick re-runs the effects.
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.mocked(Math.random).mockRestore();
  });

  it("counts down and nudges settle once per deadline, after a pause", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T19:00:00.000Z"));
    const fetchMock = reply();
    vi.stubGlobal("fetch", fetchMock);
    const deadline = "2026-03-01T19:00:02.000Z";
    const { rerender } = render(
      <Countdown leagueId="L1" deadline={deadline} />,
    );
    expect(screen.getByRole("timer")).toHaveTextContent("0:02");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(screen.getByRole("timer")).toHaveTextContent("0:00");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NUDGE_JITTER_MS + 10);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/L1/draft/settle",
      expect.objectContaining({ method: "POST" }),
    );
    expect(refresh).toHaveBeenCalled();
    // More ticks at zero do not nudge again for the same deadline.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // A new deadline that passes nudges once more.
    rerender(<Countdown leagueId="L1" deadline="2026-03-01T19:00:08.000Z" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000 + NUDGE_JITTER_MS);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

const group = (over: Partial<GroupStatus>): GroupStatus => ({
  number: 1,
  memberIds: ["a", "b"],
  pickNumber: 3,
  totalPicks: 50,
  round: 2,
  onClock: { userId: "b", displayName: "Bo" },
  deadline: "2099-01-01T00:00:00.000Z",
  finished: false,
  recent: [
    { pickNumber: 2, round: 1, displayName: "Bo", text: "Rain", auto: true },
    { pickNumber: 1, round: 1, displayName: "Ada", text: "Snow", auto: false },
  ],
  ...over,
});

describe("DraftStatus", () => {
  it("puts the viewer's group first and shows the clock and latest picks", () => {
    render(
      <DraftStatus
        leagueId="L1"
        viewerId="me"
        completed={false}
        groups={[
          group({ number: 1 }),
          group({
            number: 2,
            memberIds: ["me", "c"],
            onClock: { userId: "me", displayName: "Me" },
            recent: [],
          }),
        ]}
      />,
    );
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings[0]).toHaveTextContent("Group 2");
    expect(headings[0]).toHaveTextContent("Your group");
    expect(screen.getByText("Me (you)")).toBeInTheDocument();
    expect(screen.getByText("No picks yet.")).toBeInTheDocument();
    const latest = screen.getByRole("list", { name: "Group 1 latest picks" });
    expect(
      within(latest)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["2. Bo: Rain (auto)", "1. Ada: Snow"]);
    expect(screen.getAllByText("Round 2 · pick 3 of 50")).toHaveLength(2);
    expect(screen.getAllByRole("timer")).toHaveLength(2);
  });

  it("shows a finished group and a completed draft", () => {
    const { unmount } = render(
      <DraftStatus
        leagueId="L1"
        viewerId="me"
        completed={false}
        groups={[group({ finished: true, onClock: null, deadline: null })]}
      />,
    );
    expect(screen.getByText("Finished.")).toBeInTheDocument();
    expect(screen.queryByRole("timer")).toBeNull();
    unmount();
    render(<DraftStatus leagueId="L1" viewerId="me" completed groups={[]} />);
    expect(screen.getByText("The draft is complete.")).toBeInTheDocument();
  });
});

describe("DevDraftPanel", () => {
  it("sends expire and the bots toggle, then refreshes", async () => {
    const fetchMock = reply();
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ToastProvider>
        <DevDraftPanel leagueId="L1" bots={false} />
      </ToastProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Expire current turns" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      leagueId: "L1",
      action: "expire",
    });
    await userEvent.click(screen.getByRole("button", { name: "Bots on" }));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      leagueId: "L1",
      action: "bots_on",
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("offers Bots off when they are on", () => {
    render(
      <ToastProvider>
        <DevDraftPanel leagueId="L1" bots />
      </ToastProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Bots off" }),
    ).toBeInTheDocument();
  });
});
