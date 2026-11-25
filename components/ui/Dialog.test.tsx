// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Dialog } from "./Dialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Confirm">
        <button onClick={() => setOpen(false)}>Close it</button>
      </Dialog>
    </>
  );
}

describe("Dialog", () => {
  it("opens with an accessible name, then closes and restores focus", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Confirm" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close it" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(opener).toHaveFocus();
  });
});
