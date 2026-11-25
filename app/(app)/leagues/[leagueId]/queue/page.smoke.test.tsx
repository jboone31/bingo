// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getLeague: vi.fn(),
  listMembers: vi.fn(),
  getQueue: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: m.getSessionUser }));
vi.mock("@/lib/leagues/read", () => ({
  getLeague: m.getLeague,
  listMembers: m.listMembers,
}));
vi.mock("@/lib/queue/read", () => ({ getQueue: m.getQueue }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { ToastProvider } from "@/components/ui/Toast";
import QueuePage from "./page";

const show = async () =>
  render(
    <ToastProvider>
      {await QueuePage({ params: Promise.resolve({ leagueId: "L1" }) })}
    </ToastProvider>,
  );

const items = [
  { id: "S1", text: "First square", submitter: "Sam", category: "Sports" },
  { id: "S2", text: "Second square", submitter: "", category: "" },
];

beforeEach(() => {
  m.getSessionUser.mockReset().mockResolvedValue({ id: "u1", email: null });
  m.getLeague.mockReset().mockResolvedValue({
    id: "L1",
    name: "Office",
    status: "pre_draft",
    draftAt: null,
  });
  m.listMembers
    .mockReset()
    .mockResolvedValue([{ userId: "u1", displayName: "Ada", role: "member" }]);
  m.getQueue.mockReset().mockResolvedValue(items);
});

describe("queue page", () => {
  it("lists the queue in order with controls while pre_draft", async () => {
    await show();
    expect(
      screen.getByRole("heading", { level: 1, name: "My queue" }),
    ).toBeInTheDocument();
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("First square");
    expect(rows[1]).toHaveTextContent("Second square");
    expect(screen.getByText("2 of 200 squares")).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: /Drag to reorder/ }),
    ).toHaveLength(2);
  });

  it("asks only for the caller's own queue", async () => {
    await show();
    expect(m.getQueue).toHaveBeenCalledWith("L1", "u1");
  });

  it("shows an empty state that links to the pool", async () => {
    m.getQueue.mockResolvedValue([]);
    await show();
    expect(screen.getByText("Your queue is empty")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse the pool" }),
    ).toHaveAttribute("href", "/leagues/L1/pool");
  });

  it("is read only after the draft starts", async () => {
    m.getLeague.mockResolvedValue({
      id: "L1",
      name: "Office",
      status: "drafting",
      draftAt: null,
    });
    await show();
    expect(screen.getByText(/Your queue is read only/)).toBeInTheDocument();
    expect(screen.getByText("First square")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Drag to reorder/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Move up/ })).toBeNull();
  });

  it("is not found for a non-member", async () => {
    m.listMembers.mockResolvedValue([]);
    await expect(show()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(m.getQueue).not.toHaveBeenCalled();
  });
});
