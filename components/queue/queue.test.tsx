// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { QueueList } from "./QueueList";
import { QueueToggle } from "./QueueToggle";

const wrap = (node: ReactNode) => render(<ToastProvider>{node}</ToastProvider>);
const reply = (status: number, body: unknown = { ok: true }) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  push.mockReset();
  refresh.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("QueueToggle", () => {
  it("flips at once, posts the add, then refreshes", async () => {
    let finish!: (value: unknown) => void;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    wrap(<QueueToggle leagueId="L1" submissionId="S1" queued={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Add to queue" }));
    // Optimistic: already shows Queued while the request is still pending.
    expect(
      screen.getByRole("button", { name: "Queued ✓" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/L1/queue",
      expect.objectContaining({ method: "POST" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      submissionId: "S1",
    });
    finish(reply(201));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("removes with DELETE when it is already queued", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    wrap(<QueueToggle leagueId="L1" submissionId="S1" queued />);
    await userEvent.click(screen.getByRole("button", { name: "Queued ✓" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/L1/queue/S1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(
      screen.getByRole("button", { name: "Add to queue" }),
    ).toBeInTheDocument();
  });

  it("rolls back and explains when the server refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(reply(409, { ok: false, reason: "queue_full" })),
    );
    wrap(<QueueToggle leagueId="L1" submissionId="S1" queued={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Add to queue" }));
    expect(await screen.findByText(/queue is full/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to queue" }),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rolls back on a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    wrap(<QueueToggle leagueId="L1" submissionId="S1" queued={false} />);
    await userEvent.click(screen.getByRole("button", { name: "Add to queue" }));
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to queue" }),
    ).toBeInTheDocument();
  });
});

const items = [
  { id: "A", text: "Alpha", submitter: "Sam", category: "Sports" },
  { id: "B", text: "Bravo", submitter: "", category: "" },
  { id: "C", text: "Charlie", submitter: "Riley", category: "Movies" },
];

const names = () =>
  screen
    .getAllByRole("listitem")
    .map((li) => within(li).getByText(/^(Alpha|Bravo|Charlie)$/).textContent);

const setup = (editable = true, list = items) =>
  wrap(
    <QueueList
      leagueId="L1"
      items={list}
      editable={editable}
      poolHref="/leagues/L1/pool"
    />,
  );

describe("QueueList", () => {
  it("shows items in order with position numbers and a count", () => {
    setup();
    expect(names()).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(screen.getByText("3 of 200 squares")).toBeInTheDocument();
    expect(screen.getByText("by Unknown")).toBeInTheDocument();
  });

  it("moves down and up with the buttons, and saves each order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Move down: Alpha" }),
    );
    expect(names()).toEqual(["Bravo", "Alpha", "Charlie"]);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/L1/queue",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      order: ["B", "A", "C"],
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Move up: Charlie" }),
    );
    expect(names()).toEqual(["Bravo", "Charlie", "Alpha"]);
  });

  it("disables Move up on the first row and Move down on the last", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Move up: Alpha" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move down: Charlie" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Move down: Alpha" }),
    ).toBeEnabled();
  });

  it("keeps keyboard focus on the moved row's button", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200)));
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Move down: Alpha" }),
    );
    expect(
      screen.getByRole("button", { name: "Move down: Alpha" }),
    ).toHaveFocus();
    // Moving to the end disables Move down, so focus goes to the other button.
    await userEvent.click(
      screen.getByRole("button", { name: "Move down: Alpha" }),
    );
    expect(
      screen.getByRole("button", { name: "Move up: Alpha" }),
    ).toHaveFocus();
  });

  it("sends one request at a time and the latest order last", async () => {
    const resolvers: ((value: unknown) => void)[] = [];
    const fetchMock = vi
      .fn()
      .mockImplementation(
        () => new Promise((resolve) => resolvers.push(resolve)),
      );
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Move down: Alpha" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Move up: Charlie" }),
    );
    // The second change waits: only one request is in flight.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolvers[0](reply(200));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      order: ["B", "C", "A"],
    });
    resolvers[1](reply(200));
  });

  it("restores the saved order and says why when saving fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(reply(500, { ok: false, reason: "internal_error" })),
    );
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Move down: Alpha" }),
    );
    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(names()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("reloads and tells the player when the queue changed elsewhere", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(reply(409, { ok: false, reason: "queue_changed" })),
    );
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Move down: Alpha" }),
    );
    expect(
      await screen.findByText(/changed somewhere else/),
    ).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
    expect(names()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("removes a row, resets the saved order, and refreshes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove from queue: Bravo" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/leagues/L1/queue/B",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(names()).toEqual(["Alpha", "Charlie"]);
    expect(refresh).toHaveBeenCalled();
    // The next reorder is based on the shortened queue.
    await userEvent.click(
      screen.getByRole("button", { name: "Move down: Alpha" }),
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      order: ["C", "A"],
    });
  });

  it("keeps a row when removal fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          reply(409, { ok: false, reason: "league_not_pre_draft" }),
        ),
    );
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Remove from queue: Bravo" }),
    );
    expect(await screen.findByText(/already started/)).toBeInTheDocument();
    expect(names()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("is read only when not editable", () => {
    setup(false);
    expect(names()).toEqual(["Alpha", "Bravo", "Charlie"]);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows an empty state with a link to the pool", () => {
    setup(true, []);
    expect(screen.getByText("Your queue is empty")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse the pool" }),
    ).toHaveAttribute("href", "/leagues/L1/pool");
  });

  it("shows an empty state after the last row is removed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200)));
    setup(true, [items[0]]);
    await userEvent.click(
      screen.getByRole("button", { name: "Remove from queue: Alpha" }),
    );
    expect(await screen.findByText("Your queue is empty")).toBeInTheDocument();
  });
});

describe("QueueList drag hint", () => {
  it("tells touch users to press and hold, and is hidden when read only", () => {
    const { unmount } = wrap(
      <QueueList leagueId="L1" items={items} editable poolHref="/p" />,
    );
    expect(screen.getByText(/Press and hold the handle/)).toBeInTheDocument();
    unmount();
    wrap(
      <QueueList leagueId="L1" items={items} editable={false} poolHref="/p" />,
    );
    expect(screen.queryByText(/Press and hold the handle/)).toBeNull();
  });
});
