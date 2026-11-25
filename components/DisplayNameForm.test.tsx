// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { DisplayNameForm } from "./DisplayNameForm";

function setup() {
  render(
    <ToastProvider>
      <DisplayNameForm initialName="Ada" />
    </ToastProvider>,
  );
}

describe("DisplayNameForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves and confirms with a toast", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profile",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(await screen.findByText("Display name saved.")).toBeInTheDocument();
  });

  it("shows a field error for a rejected name", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400 }),
    );
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByLabelText("Display name")).toBeInvalid();
    expect(await screen.findByText(/1 to 40 characters/)).toBeInTheDocument();
  });

  it("toasts a failure on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(
      await screen.findByText("Could not save. Try again."),
    ).toBeInTheDocument();
  });
});
