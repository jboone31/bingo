// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("labels the input", () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("links hint and error and marks the input invalid", () => {
    render(<TextField label="Name" hint="Shown to others" error="Too long" />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Shown to others Too long");
  });

  it("is not invalid without an error", () => {
    render(<TextField label="Name" />);
    expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-invalid");
  });
});
