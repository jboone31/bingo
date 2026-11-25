// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getLeague: vi.fn(),
  listMembers: vi.fn(),
  getPoolPage: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: m.getSessionUser }));
vi.mock("@/lib/leagues/read", () => ({
  getLeague: m.getLeague,
  listMembers: m.listMembers,
}));
vi.mock("@/lib/pool/read", () => ({ getPoolPage: m.getPoolPage }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { ToastProvider } from "@/components/ui/Toast";
import PoolPage from "./page";

const render_ = async (searchParams: { page?: string } = {}) =>
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
];

beforeEach(() => {
  m.getSessionUser.mockReset().mockResolvedValue({ id: "u1", email: null });
  m.getLeague
    .mockReset()
    .mockResolvedValue({ id: "L1", name: "Office", status: "pre_draft" });
  m.listMembers
    .mockReset()
    .mockResolvedValue([{ userId: "u1", displayName: "Ada", role: "admin" }]);
  m.getPoolPage
    .mockReset()
    .mockResolvedValue({ items, total: 1, page: 1, pageCount: 1 });
});

describe("pool page", () => {
  it("gives the admin the tools while pre_draft", async () => {
    await render_();
    expect(
      screen.getByRole("region", { name: "Add a square" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Upload CSV" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Clear pool" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("is read only for a regular member", async () => {
    m.listMembers.mockResolvedValue([
      { userId: "u1", displayName: "Ada", role: "member" },
    ]);
    await render_();
    expect(screen.getByText("Team X wins")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Add a square" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("is read only for the admin after the draft starts", async () => {
    m.getLeague.mockResolvedValue({
      id: "L1",
      name: "Office",
      status: "drafting",
    });
    await render_();
    expect(screen.queryByRole("button", { name: "Clear pool" })).toBeNull();
    expect(screen.getByText("Team X wins")).toBeInTheDocument();
  });

  it("shows an empty state, with a hint for the admin", async () => {
    m.getPoolPage.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
    await render_();
    expect(screen.getByText("The pool is empty")).toBeInTheDocument();
    expect(screen.getByText(/Add squares one at a time/)).toBeInTheDocument();
  });

  it("is not found for a non-member", async () => {
    m.listMembers.mockResolvedValue([]);
    await expect(render_()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("passes the page number through and shows pagination", async () => {
    m.getPoolPage.mockResolvedValue({
      items,
      total: 120,
      page: 2,
      pageCount: 3,
    });
    await render_({ page: "2" });
    expect(m.getPoolPage).toHaveBeenCalledWith("L1", "2");
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });
});
