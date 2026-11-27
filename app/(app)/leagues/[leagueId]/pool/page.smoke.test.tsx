// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getLeague: vi.fn(),
  listMembers: vi.fn(),
  getPoolPage: vi.fn(),
  listCategories: vi.fn(),
  getQueuedIds: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: m.getSessionUser }));
vi.mock("@/lib/leagues/read", () => ({
  getLeague: m.getLeague,
  listMembers: m.listMembers,
}));
vi.mock("@/lib/pool/read", () => ({
  getPoolPage: m.getPoolPage,
  listCategories: m.listCategories,
}));
vi.mock("@/lib/queue/read", () => ({ getQueuedIds: m.getQueuedIds }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { ToastProvider } from "@/components/ui/Toast";
import PoolPage from "./page";

const show = async (searchParams: Record<string, string | string[]> = {}) =>
  render(
    <ToastProvider>
      {await PoolPage({
        params: Promise.resolve({ leagueId: "L1" }),
        searchParams: Promise.resolve(searchParams),
      })}
    </ToastProvider>,
  );

const items = [
  { id: "S1", text: "Team X wins", submitter: "Sam", category: "Sports" },
  { id: "S2", text: "Movie Y flops", submitter: "", category: "" },
];
const page = (over = {}) => ({
  items,
  total: 2,
  poolTotal: 2,
  page: 1,
  pageCount: 1,
  ...over,
});

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
    .mockResolvedValue([{ userId: "u1", displayName: "Ada", role: "admin" }]);
  m.getPoolPage.mockReset().mockResolvedValue(page());
  m.listCategories.mockReset().mockResolvedValue([
    { key: "sports", label: "Sports", count: 1 },
    { key: "", label: "", count: 1 },
  ]);
  m.getQueuedIds.mockReset().mockResolvedValue(new Set(["S1"]));
});

describe("pool page", () => {
  it("gives the admin the tools while pre_draft", async () => {
    await show();
    expect(
      screen.getByRole("region", { name: "Add a square" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Upload CSV" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear pool" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(2);
  });

  it("is read only for a regular member, but they can still queue", async () => {
    m.listMembers.mockResolvedValue([
      { userId: "u1", displayName: "Ada", role: "member" },
    ]);
    await show();
    expect(screen.getByText("Team X wins")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Add a square" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Queued ✓" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add to queue" }),
    ).toBeInTheDocument();
  });

  it("hides edit tools but keeps queue buttons during the draft", async () => {
    m.getLeague.mockResolvedValue({
      id: "L1",
      name: "Office",
      status: "drafting",
      draftAt: null,
    });
    await show();
    expect(screen.queryByRole("button", { name: "Clear pool" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Add to queue" }),
    ).toBeInTheDocument();
    expect(m.getQueuedIds).toHaveBeenCalled();
  });

  it("hides queue buttons once the draft is over", async () => {
    m.getLeague.mockResolvedValue({
      id: "L1",
      name: "Office",
      status: "in_progress",
      draftAt: null,
    });
    await show();
    expect(screen.queryByRole("button", { name: /queue/i })).toBeNull();
    expect(m.getQueuedIds).not.toHaveBeenCalled();
    expect(screen.getByText("Team X wins")).toBeInTheDocument();
  });

  it("shows an empty state, with a hint for the admin, and no filter bar", async () => {
    m.getPoolPage.mockResolvedValue(
      page({ items: [], total: 0, poolTotal: 0 }),
    );
    await show();
    expect(screen.getByText("The pool is empty")).toBeInTheDocument();
    expect(screen.getByText(/Add squares one at a time/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Sort by")).toBeNull();
  });

  it("is not found for a non-member", async () => {
    m.listMembers.mockResolvedValue([]);
    await expect(show()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("passes the parsed filter and page through to the read", async () => {
    await show({ cat: "c:sports", q: "cup", sort: "text", page: "2" });
    expect(m.getPoolPage).toHaveBeenCalledWith(
      "L1",
      { category: { kind: "named", key: "sports" }, q: "cup", sort: "text" },
      "2",
    );
  });

  it("falls back to defaults for a hand-edited URL", async () => {
    await show({ cat: ["x", "y"], sort: "price", q: "a".repeat(500) });
    const query = m.getPoolPage.mock.calls[0][1];
    expect(query.category).toEqual({ kind: "all" });
    expect(query.sort).toBe("added");
    expect([...query.q]).toHaveLength(100);
  });

  it("shows the filter bar with the current choices and a count", async () => {
    m.getPoolPage.mockResolvedValue(page({ total: 1, poolTotal: 2 }));
    await show({ cat: "c:sports" });
    expect(screen.getByRole("combobox", { name: "Category" })).toHaveValue(
      "c:sports",
    );
    expect(screen.getByText("1 of 2 squares in Office")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear" })).toBeInTheDocument();
  });

  it("shows a no-match state with a clear link when the filter finds nothing", async () => {
    m.getPoolPage.mockResolvedValue(
      page({ items: [], total: 0, poolTotal: 2 }),
    );
    await show({ q: "zzz" });
    expect(screen.getByText("No squares match")).toBeInTheDocument();
    expect(screen.getByText(/text contains "zzz"/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Clear the filter" }),
    ).toHaveAttribute("href", "/leagues/L1/pool");
  });

  it("keeps the filter in pagination links", async () => {
    m.getPoolPage.mockResolvedValue(
      page({ total: 120, poolTotal: 120, page: 2, pageCount: 3 }),
    );
    await show({ cat: "none", page: "2" });
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute(
      "href",
      "/leagues/L1/pool?cat=none&page=3",
    );
  });

  it("shows the draft date line", async () => {
    await show();
    expect(screen.getByText("Draft date to be set")).toBeInTheDocument();
  });
});
