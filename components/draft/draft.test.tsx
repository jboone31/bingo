// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { DraftGroups } from "./DraftGroups";
import { DraftSetupPanel } from "./DraftSetupPanel";
import { GateSummary } from "./GateSummary";
import { gateText } from "./gateText";

const wrap = (node: ReactNode) => render(<ToastProvider>{node}</ToastProvider>);
const reply = (status: number, body: unknown) =>
  vi
    .fn()
    .mockResolvedValue({ ok: status < 400, status, json: async () => body });

const panel = (over: Partial<Parameters<typeof DraftSetupPanel>[0]> = {}) =>
  wrap(
    <DraftSetupPanel
      leagueId="L1"
      members={15}
      pool={125}
      groupCount={3}
      pickSeconds={60}
      {...over}
    />,
  );
const startButton = () =>
  screen.getByRole("button", { name: "Start the draft" });

beforeEach(() => refresh.mockReset());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("gateText", () => {
  it("describes even and uneven groups and the pool", () => {
    expect(gateText({ members: 15, groups: 3, pool: 125 })).toEqual({
      ok: true,
      pool: "Pool 125 / 125 needed",
      groups: "3 groups of 5",
      problem: null,
    });
    expect(gateText({ members: 15, groups: 4, pool: 0 }).groups).toBe(
      "4 groups: 4, 4, 4, 3",
    );
    expect(gateText({ members: 15, groups: 1, pool: 374 }).problem).toBe(
      "The pool needs 1 more square.",
    );
    expect(gateText({ members: 2, groups: 3, pool: 999 }).problem).toBe(
      "2 players is too few for 3 groups.",
    );
  });
});

describe("DraftSetupPanel", () => {
  it("updates the gate as the group count is typed, before saving", async () => {
    panel();
    const gate = screen.getByRole("status", { name: "Start gate" });
    expect(gate).toHaveTextContent("Pool 125 / 125 needed");
    const groups = screen.getByLabelText("Groups");
    await userEvent.clear(groups);
    await userEvent.type(groups, "1");
    expect(gate).toHaveTextContent("15 players · 1 group of 15");
    expect(gate).toHaveTextContent("Pool 125 / 375 needed");
    expect(gate).toHaveTextContent("The pool needs 250 more squares.");
  });

  it("shows the timer in minutes and seconds", async () => {
    panel();
    const seconds = screen.getByLabelText("Seconds per pick");
    await userEvent.clear(seconds);
    await userEvent.type(seconds, "150");
    expect(screen.getByText(/2 min 30 s\./)).toBeInTheDocument();
  });

  it("saves only the changed values and refreshes", async () => {
    const fetchMock = reply(200, { ok: true, groupCount: 3, pickSeconds: 90 });
    vi.stubGlobal("fetch", fetchMock);
    panel();
    const seconds = screen.getByLabelText("Seconds per pick");
    await userEvent.clear(seconds);
    await userEvent.type(seconds, "90");
    await userEvent.click(
      screen.getByRole("button", { name: "Save settings" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/L1/draft-settings",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      pickSeconds: 90,
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("refuses out-of-range values without sending", async () => {
    const fetchMock = reply(200, {});
    vi.stubGlobal("fetch", fetchMock);
    panel();
    const groups = screen.getByLabelText("Groups");
    await userEvent.clear(groups);
    await userEvent.type(groups, "11");
    await userEvent.click(
      screen.getByRole("button", { name: "Save settings" }),
    );
    expect(screen.getByText("Choose 1 to 10 groups.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("disables Start while there are unsaved changes", async () => {
    panel();
    expect(startButton()).toBeEnabled();
    const groups = screen.getByLabelText("Groups");
    await userEvent.clear(groups);
    await userEvent.type(groups, "5");
    expect(startButton()).toBeDisabled();
    expect(
      screen.getByText("Save your changes before starting."),
    ).toBeInTheDocument();
  });

  it("disables Start with the reason when the gate fails", () => {
    panel({ pool: 100, groupCount: 1 });
    expect(startButton()).toBeDisabled();
    expect(
      screen.getAllByText("The pool needs 275 more squares.").length,
    ).toBeGreaterThan(0);
  });

  it("disables Start when there are fewer players than groups", () => {
    panel({ members: 2, groupCount: 3, pool: 999 });
    expect(startButton()).toBeDisabled();
  });

  it("confirms with a summary and sends the confirmed numbers", async () => {
    const fetchMock = reply(200, { ok: true });
    vi.stubGlobal("fetch", fetchMock);
    panel({ pickSeconds: 90 });
    await userEvent.click(startButton());
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("15 players in 3 groups of 5"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("1 min 30 s per pick")).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Start draft" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/L1/start",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      expected: { members: 15, groupCount: 3 },
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("refreshes after a refused start so the new numbers show", async () => {
    vi.stubGlobal(
      "fetch",
      reply(409, { ok: false, reason: "draft_setup_changed" }),
    );
    panel();
    await userEvent.click(startButton());
    await userEvent.click(screen.getByRole("button", { name: "Start draft" }));
    expect(
      await screen.findByText(
        "Players or groups changed. Check the new numbers and start again.",
      ),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });
});

describe("GateSummary", () => {
  it("shows groups, timer and the pool line", () => {
    render(<GateSummary members={15} groups={3} pickSeconds={45} pool={100} />);
    expect(screen.getByText("3 groups · 45 s per pick")).toBeInTheDocument();
    expect(screen.getByText("Pool 100 / 125 needed")).toBeInTheDocument();
    expect(
      screen.getByText("The pool needs 25 more squares."),
    ).toBeInTheDocument();
  });
});

describe("DraftGroups", () => {
  const groups = [
    {
      number: 1,
      members: [
        { userId: "a", displayName: "Ada", position: 1 },
        { userId: "b", displayName: "Bo", position: 2 },
      ],
    },
    {
      number: 2,
      members: [
        { userId: "me", displayName: "Me", position: 1 },
        { userId: "c", displayName: "Cy", position: 2 },
      ],
    },
  ];

  it("puts the viewer's group first, marked, with players in order", () => {
    render(<DraftGroups groups={groups} viewerId="me" />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings[0]).toHaveTextContent("Group 2");
    expect(headings[0]).toHaveTextContent("Your group");
    expect(headings[1]).toHaveTextContent("Group 1");
    const lists = screen.getAllByRole("list");
    expect(
      within(lists[0])
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Me (you)", "Cy"]);
  });

  it("keeps number order for a viewer in no group", () => {
    render(<DraftGroups groups={groups} viewerId="zz" />);
    expect(screen.getAllByRole("heading", { level: 3 })[0]).toHaveTextContent(
      "Group 1",
    );
    expect(screen.queryByText("Your group")).toBeNull();
  });
});
