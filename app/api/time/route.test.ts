import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

import { GET } from "./route";

const call = () =>
  GET(new NextRequest("http://localhost/api/time"), {
    params: Promise.resolve({}),
  });

describe("GET /api/time", () => {
  beforeEach(() => {
    getSessionUser.mockReset().mockResolvedValue({ id: "u1", email: null });
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, reason: "unauthenticated" });
  });

  it("returns the server clock and is never cached", async () => {
    const before = Date.now();
    const res = await call();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.now).toBeGreaterThanOrEqual(before);
    expect(body.now).toBeLessThanOrEqual(Date.now());
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
