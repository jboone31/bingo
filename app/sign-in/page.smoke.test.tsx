// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/utils/supabase/client", () => ({ createClient: vi.fn() }));

import SignInPage from "./page";

describe("sign-in page", () => {
  it("shows the Google button", async () => {
    render(await SignInPage({ searchParams: Promise.resolve({}) }));
    expect(
      screen.getByRole("button", { name: "Sign in with Google" }),
    ).toBeInTheDocument();
  });

  it("shows a fixed message for a known error and ignores unknown ones", async () => {
    const { unmount } = render(
      await SignInPage({
        searchParams: Promise.resolve({ error: "auth_failed" }),
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("did not complete");
    unmount();
    render(
      await SignInPage({
        searchParams: Promise.resolve({ error: "<script>" }),
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
