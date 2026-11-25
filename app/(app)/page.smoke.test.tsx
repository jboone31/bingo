// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("home page", () => {
  it("renders the heading and the empty leagues panel", () => {
    render(<Home />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Bingo Draft" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "My leagues" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No leagues yet")).toBeInTheDocument();
  });
});
