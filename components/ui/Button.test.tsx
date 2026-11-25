// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, ButtonLink } from "./Button";

describe("Button", () => {
  it("defaults to type=button and fires onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    const button = screen.getByRole("button", { name: "Go" });
    expect(button).toHaveAttribute("type", "button");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and busy while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders a link with the same look", () => {
    render(<ButtonLink href="/profile">Profile</ButtonLink>);
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
  });
});
