// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/leagues/1/pool" }));

import { AppHeader } from "./AppHeader";
import { SubNav } from "./SubNav";
import { UserMenu } from "./UserMenu";

describe("AppHeader", () => {
  it("shows the app name and the user menu when signed in", () => {
    render(<AppHeader displayName="Ada" />);
    expect(screen.getByRole("link", { name: "Bingo Draft" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("button", { name: "Ada" })).toBeInTheDocument();
  });

  it("omits the menu when there is no user", () => {
    render(<AppHeader displayName={null} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("UserMenu", () => {
  it("opens with Profile and a POST sign-out form, and closes on Escape", async () => {
    render(<UserMenu displayName="Ada" />);
    const trigger = screen.getByRole("button", { name: "Ada" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(trigger);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    const signOut = screen.getByRole("button", { name: "Sign out" });
    const form = signOut.closest("form");
    expect(form).toHaveAttribute("action", "/api/auth/sign-out");
    expect(form).toHaveAttribute("method", "post");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: "Profile" })).toBeNull();
    expect(trigger).toHaveFocus();
  });
});

describe("SubNav", () => {
  it("marks only the current item", () => {
    render(
      <SubNav
        label="League"
        items={[
          { href: "/leagues/1", label: "Overview" },
          { href: "/leagues/1/pool", label: "Pool" },
        ]}
      />,
    );
    expect(
      screen.getByRole("navigation", { name: "League" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pool" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
