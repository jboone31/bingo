import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOut = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({ auth: { signOut } }),
}));

import { POST } from "./route";

const call = () =>
  POST(
    new NextRequest("http://localhost/api/auth/sign-out", { method: "POST" }),
  );

describe("POST /api/auth/sign-out", () => {
  beforeEach(() => {
    signOut.mockReset().mockResolvedValue({ error: null });
  });

  it("signs out and redirects with 303", async () => {
    const res = await call();
    expect(signOut).toHaveBeenCalled();
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/sign-in");
  });

  it("still redirects when signOut throws", async () => {
    signOut.mockRejectedValue(new Error("down"));
    const res = await call();
    expect(res.status).toBe(303);
  });
});
