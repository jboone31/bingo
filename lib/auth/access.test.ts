import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decideAccess } from "./access";

describe("decideAccess", () => {
  it("redirects unauthenticated pages to sign-in with next", () => {
    expect(decideAccess("/leagues", false, "?a=1")).toEqual({
      kind: "redirect",
      to: "/sign-in?next=%2Fleagues%3Fa%3D1",
    });
  });

  it("returns unauthorized for unauthenticated API routes", () => {
    expect(decideAccess("/api/profile", false)).toEqual({
      kind: "unauthorized",
    });
  });

  it("allows public paths without a session", () => {
    for (const path of [
      "/sign-in",
      "/api/health",
      "/api/auth/callback",
      "/api/dev/sign-in",
    ]) {
      expect(decideAccess(path, false)).toEqual({ kind: "allow" });
    }
  });

  it("sends a signed-in user away from sign-in", () => {
    expect(decideAccess("/sign-in", true)).toEqual({
      kind: "redirect",
      to: "/",
    });
  });

  it("allows signed-in users elsewhere", () => {
    expect(decideAccess("/profile", true)).toEqual({ kind: "allow" });
  });

  it("never allows a non-public path without a session", () => {
    fc.assert(
      fc.property(fc.webPath(), (tail) => {
        const path = `/private${tail}`;
        expect(decideAccess(path, false).kind).not.toBe("allow");
      }),
      { numRuns: 200 },
    );
  });

  it("never redirects API paths", () => {
    fc.assert(
      fc.property(fc.webPath(), fc.boolean(), (tail, authed) => {
        const path = `/api/x${tail}`;
        expect(decideAccess(path, authed).kind).not.toBe("redirect");
      }),
      { numRuns: 200 },
    );
  });
});
