// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalTime } from "./LocalTime";

const ISO = "2026-03-01T19:00:00.000Z";

describe("LocalTime", () => {
  it("renders a time element with the ISO value", () => {
    render(<LocalTime iso={ISO} />);
    const el = screen.getByText(/2026/);
    expect(el.tagName).toBe("TIME");
    expect(el).toHaveAttribute("datetime", ISO);
  });

  it("server-renders UTC with a label", () => {
    expect(renderToString(<LocalTime iso={ISO} />)).toContain("UTC");
  });
});
