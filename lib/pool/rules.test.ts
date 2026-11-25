import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { LeagueStatus, MemberRole } from "@/lib/leagues/types";
import { MAX_SUBMISSIONS } from "./limits";
import { canAddSubmissions, canEditPool } from "./rules";

const status = fc.constantFrom<LeagueStatus>(
  "pre_draft",
  "drafting",
  "in_progress",
);
const role = fc.constantFrom<MemberRole>("admin", "member");

describe("canEditPool", () => {
  it("only the admin, only pre_draft", () => {
    fc.assert(
      fc.property(status, role, (s, r) => {
        expect(canEditPool({ status: s, actorRole: r }).ok).toBe(
          s === "pre_draft" && r === "admin",
        );
      }),
      { numRuns: 100 },
    );
  });

  it("uses the right reasons", () => {
    expect(canEditPool({ status: "pre_draft", actorRole: "member" })).toEqual({
      ok: false,
      reason: "not_admin",
      status: 403,
    });
    expect(canEditPool({ status: "drafting", actorRole: "admin" })).toEqual({
      ok: false,
      reason: "league_not_pre_draft",
      status: 409,
    });
  });
});

describe("canAddSubmissions", () => {
  const base = { status: "pre_draft" as const, actorRole: "admin" as const };

  it("allows up to exactly the cap and refuses one more", () => {
    expect(
      canAddSubmissions({
        ...base,
        currentCount: MAX_SUBMISSIONS - 3,
        adding: 3,
      }),
    ).toEqual({ ok: true });
    expect(
      canAddSubmissions({
        ...base,
        currentCount: MAX_SUBMISSIONS - 3,
        adding: 4,
      }),
    ).toEqual({ ok: false, reason: "pool_full", status: 409 });
  });

  it("is allowed exactly when the edit rules pass and the total fits", () => {
    fc.assert(
      fc.property(
        status,
        role,
        fc.integer({ min: 0, max: 6000 }),
        fc.integer({ min: 1, max: 6000 }),
        (s, r, count, adding) => {
          const expected =
            s === "pre_draft" &&
            r === "admin" &&
            count + adding <= MAX_SUBMISSIONS;
          expect(
            canAddSubmissions({
              status: s,
              actorRole: r,
              currentCount: count,
              adding,
            }).ok,
          ).toBe(expected);
        },
      ),
      { numRuns: 200 },
    );
  });
});
