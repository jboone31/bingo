// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TOAST_DURATION_MS, ToastProvider, useToast } from "./Toast";

function Trigger() {
  const { show } = useToast();
  return <button onClick={() => show("Saved", "success")}>Fire</button>;
}

describe("Toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces politely and can be dismissed", async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Fire" }));
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Saved");
    await userEvent.click(
      screen.getByRole("button", { name: "Dismiss notification" }),
    );
    expect(region).not.toHaveTextContent("Saved");
  });

  it("dismisses itself after the timeout", () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => {
      screen.getByRole("button", { name: "Fire" }).click();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS + 1);
    });
    expect(screen.getByRole("status")).not.toHaveTextContent("Saved");
  });

  it("throws outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Trigger />)).toThrow("ToastProvider");
    spy.mockRestore();
  });
});
