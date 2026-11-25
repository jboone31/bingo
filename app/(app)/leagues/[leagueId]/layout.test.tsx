// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getLeague: vi.fn(),
  listMembers: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: m.getSessionUser }));
vi.mock("@/lib/leagues/read", () => ({
  getLeague: m.getLeague,
  listMembers: m.listMembers,
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/leagues/L1",
}));

import LeagueLayout from "./layout";

const show = async () =>
  render(
    await LeagueLayout({
      children: <p>page</p>,
      params: Promise.resolve({ leagueId: "L1" }),
    }),
  );

const labels = () =>
  screen.getAllByRole("link").map((link) => link.textContent);

beforeEach(() => {
  m.getSessionUser.mockReset().mockResolvedValue({ id: "u1", email: null });
  m.getLeague.mockReset().mockResolvedValue({ id: "L1", name: "Office" });
});

describe("league layout navigation", () => {
  it("shows Overview, Pool and Settings to the admin", async () => {
    m.listMembers.mockResolvedValue([
      { userId: "u1", displayName: "A", role: "admin" },
    ]);
    await show();
    expect(labels()).toEqual(["Overview", "Pool", "Queue", "Settings"]);
  });

  it("shows Overview, Pool and Queue, but not Settings, to a member", async () => {
    m.listMembers.mockResolvedValue([
      { userId: "u1", displayName: "A", role: "member" },
    ]);
    await show();
    expect(labels()).toEqual(["Overview", "Pool", "Queue"]);
  });

  it("is not found for a non-member league", async () => {
    m.getLeague.mockResolvedValue(null);
    await expect(show()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
