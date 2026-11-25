// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { ToastProvider } from "@/components/ui/Toast";
import InvitePage from "./page";

const page = async (code: string) =>
  InvitePage({ params: Promise.resolve({ code }) });

describe("invite link page", () => {
  it("prefills the code and does not join on its own", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ToastProvider>{await page("k7p2qx9m")}</ToastProvider>);
    expect(screen.getByLabelText("Join code")).toHaveValue("K7P2QX9M");
    expect(
      screen.getByRole("button", { name: "Join league" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("shows a message for a code that cannot be valid", async () => {
    render(await page("nope"));
    expect(
      screen.getByText("That invite link is not valid"),
    ).toBeInTheDocument();
  });
});
