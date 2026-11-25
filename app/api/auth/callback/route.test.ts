import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({ auth: { exchangeCodeForSession } }),
}));

import { GET } from "./route";

const call = (qs: string) =>
  GET(new NextRequest(`http://localhost/api/auth/callback${qs}`));

describe("GET /api/auth/callback", () => {
  beforeEach(() => {
    exchangeCodeForSession.mockReset().mockResolvedValue({ error: null });
  });

  it("redirects to a safe next after exchanging the code", async () => {
    const res = await call("?code=abc&next=%2Fprofile");
    expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(res.headers.get("location")).toBe("http://localhost/profile");
  });

  it("ignores an unsafe next", async () => {
    const res = await call("?code=abc&next=%2F%2Fevil.com");
    expect(res.headers.get("location")).toBe("http://localhost/");
  });

  it("fails without a code", async () => {
    const res = await call("");
    expect(res.headers.get("location")).toBe(
      "http://localhost/sign-in?error=auth_failed",
    );
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("fails when the exchange errors or throws", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("x") });
    expect((await call("?code=abc")).headers.get("location")).toContain(
      "auth_failed",
    );
    exchangeCodeForSession.mockRejectedValue(new Error("x"));
    expect((await call("?code=abc")).headers.get("location")).toContain(
      "auth_failed",
    );
  });
});
