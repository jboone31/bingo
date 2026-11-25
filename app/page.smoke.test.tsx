// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser, readOwnDisplayName } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  readOwnDisplayName: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/profile/readProfile", () => ({ readOwnDisplayName }));

import Home from "./page";

describe("home page", () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    readOwnDisplayName.mockReset();
  });

  it("renders the heading", async () => {
    getSessionUser.mockResolvedValue(null);
    render(await Home());
    expect(
      screen.getByRole("heading", { level: 1, name: "Bingo Draft" }),
    ).toBeInTheDocument();
  });

  it("shows the display name and sign out when signed in", async () => {
    getSessionUser.mockResolvedValue({ id: "u1", email: null });
    readOwnDisplayName.mockResolvedValue("Ada");
    render(await Home());
    expect(screen.getByText("Signed in as Ada.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign out" }),
    ).toBeInTheDocument();
  });
});
