// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { devSignInUsers } = vi.hoisted(() => ({ devSignInUsers: vi.fn() }));
vi.mock("@/utils/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/dev/signIn", () => ({ devSignInUsers }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { ToastProvider } from "@/components/ui/Toast";
import SignInPage from "./page";

const show = async (params: { next?: string; error?: string } = {}) =>
  render(
    <ToastProvider>
      {await SignInPage({ searchParams: Promise.resolve(params) })}
    </ToastProvider>,
  );

beforeEach(() => {
  devSignInUsers.mockReset().mockResolvedValue([]);
});

describe("sign-in page", () => {
  it("shows the Google button and no dev sign-in by default", async () => {
    await show();
    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dev sign-in")).toBeNull();
  });

  it("shows a fixed message for a known error and ignores unknown ones", async () => {
    const { unmount } = await show({ error: "auth_failed" });
    expect(screen.getByRole("alert")).toHaveTextContent("did not complete");
    unmount();
    await show({ error: "<script>" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers the dev sign-in when seed players are available", async () => {
    devSignInUsers.mockResolvedValue([
      { id: "u1", number: 1, displayName: "Seed Player 001" },
    ]);
    await show();
    expect(
      screen.getByRole("region", { name: "Dev sign-in" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Seed player")).toBeInTheDocument();
  });
});
