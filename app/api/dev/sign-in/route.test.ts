import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const m = vi.hoisted(() => ({ assertDevTools: vi.fn(), actAs: vi.fn() }));
vi.mock("@/lib/dev/gate", () => ({ assertDevTools: m.assertDevTools }));
vi.mock("@/lib/dev/actAs", () => ({ actAs: m.actAs }));
// The handler imports the session helper; this route must never use it.
const getSessionUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

import { POST } from "./route";

const TARGET = "33333333-3333-4333-8333-333333333333";
const req = (body: unknown, host = "192.168.86.243:3000") =>
  new NextRequest("http://localhost/api/dev/sign-in", {
    method: "POST",
    headers: { host },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  m.assertDevTools.mockReset().mockImplementation(() => undefined);
  m.actAs.mockReset().mockResolvedValue(true);
  getSessionUser.mockReset();
});

describe("POST /api/dev/sign-in", () => {
  it("signs in a seed player without needing a session", async () => {
    const res = await POST(req({ userId: TARGET }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.actAs).toHaveBeenCalledWith(TARGET);
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("is a 404 with no other effect when dev tools are off", async () => {
    m.assertDevTools.mockImplementation(() => {
      throw new ApiError("not_found", 404);
    });
    const res = await POST(req({ userId: TARGET }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "not_found" });
    expect(m.actAs).not.toHaveBeenCalled();
  });

  it.each([
    "bingo-tau-tan.vercel.app",
    "example.com",
    "localhost.evil.com",
    "8.8.8.8:3000",
  ])("is a 404 for the public host %s even with dev tools on", async (host) => {
    const res = await POST(req({ userId: TARGET }, host));
    expect(res.status).toBe(404);
    expect(m.actAs).not.toHaveBeenCalled();
  });

  it.each([
    "localhost:3000",
    "127.0.0.1:3000",
    "192.168.1.20:3000",
    "mac.local:3000",
  ])("allows the local host %s", async (host) => {
    expect((await POST(req({ userId: TARGET }, host))).status).toBe(200);
  });

  it("is 404 when the target is not a seed player", async () => {
    m.actAs.mockResolvedValue(false);
    const res = await POST(req({ userId: TARGET }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "not_found" });
  });

  it("is 400 for a bad body", async () => {
    expect((await POST(req({ userId: "nope" }))).status).toBe(400);
    expect((await POST(req({ userId: TARGET, x: 1 }))).status).toBe(400);
    expect(m.actAs).not.toHaveBeenCalled();
  });

  it("hides unexpected errors", async () => {
    m.actAs.mockRejectedValue(new Error("service key leaked"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await POST(req({ userId: TARGET }));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("leaked");
    spy.mockRestore();
  });
});
