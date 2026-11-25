import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser, withTransaction, updateProfile } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  updateProfile: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/profile/updateProfile", () => ({ updateProfile }));

import { PATCH } from "./route";

function req(body: unknown, raw = false): NextRequest {
  return new NextRequest("http://localhost/api/profile", {
    method: "PATCH",
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

describe("PATCH /api/profile", () => {
  beforeEach(() => {
    getSessionUser.mockReset().mockResolvedValue({ id: "u1", email: null });
    updateProfile.mockReset();
    withTransaction
      .mockReset()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  });

  it.each([
    ["not json", "{", true],
    ["array", [], false],
    ["unknown key", { displayName: "A", role: "admin" }, false],
  ])("400 invalid_body for %s", async (_label, body, raw) => {
    const res = await PATCH(req(body, raw));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "invalid_body" });
  });

  it("400 invalid_display_name for a blank name", async () => {
    const res = await PATCH(req({ displayName: "  " }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "invalid_display_name",
    });
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await PATCH(req({ displayName: "Ada" }));
    expect(res.status).toBe(401);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it("updates the caller's own profile with the trimmed name", async () => {
    updateProfile.mockResolvedValue({ id: "u1", displayName: "Ada" });
    const res = await PATCH(req({ displayName: " Ada " }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      profile: { displayName: "Ada" },
    });
    expect(updateProfile).toHaveBeenCalledWith({}, "u1", "Ada");
  });

  it("404 when the profile row is missing", async () => {
    updateProfile.mockResolvedValue(null);
    const res = await PATCH(req({ displayName: "Ada" }));
    expect(res.status).toBe(404);
  });

  it("500 without leaking the database error", async () => {
    withTransaction.mockRejectedValue(new Error("password=hunter2"));
    const res = await PATCH(req({ displayName: "Ada" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, reason: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });
});
