// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser, listMyLeagues } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  listMyLeagues: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/leagues/read", () => ({ listMyLeagues }));

import Home from "./page";

describe("home page", () => {
  beforeEach(() => {
    getSessionUser.mockReset().mockResolvedValue({ id: "u1", email: null });
    listMyLeagues.mockReset();
  });

  it("shows an empty state with create and join actions", async () => {
    listMyLeagues.mockResolvedValue([]);
    render(await Home());
    expect(
      screen.getByRole("heading", { level: 1, name: "My leagues" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No leagues yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create a league" }),
    ).toHaveAttribute("href", "/leagues/new");
    expect(
      screen.getByRole("link", { name: "Join with a code" }),
    ).toHaveAttribute("href", "/leagues/join");
  });

  it("lists leagues with links, badges and header actions", async () => {
    listMyLeagues.mockResolvedValue([
      {
        id: "l1",
        name: "Office 2026",
        status: "pre_draft",
        draftAt: null,
        memberCount: 12,
        role: "admin",
      },
    ]);
    render(await Home());
    const card = screen.getByRole("link", { name: /Office 2026/ });
    expect(card).toHaveAttribute("href", "/leagues/l1");
    expect(card).toHaveTextContent("Pre-draft");
    expect(card).toHaveTextContent("Admin");
    expect(card).toHaveTextContent("12 players");
    expect(card).toHaveTextContent("Date to be set");
    expect(screen.getByRole("link", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Join" })).toBeInTheDocument();
  });
});
