import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SCENARIOS, planFor, totalMembers } from "./scenarios";

const names = Object.keys(SCENARIOS);

describe("scenarios", () => {
  it("has the four F2 scenarios", () => {
    expect(names.sort()).toEqual([
      "league_empty",
      "league_full",
      "league_with_players",
      "member_view",
    ]);
  });

  it("every plan fits a league and has exactly one admin", () => {
    for (const name of names) {
      const plan = planFor(name)!;
      expect(totalMembers(plan)).toBeGreaterThanOrEqual(1);
      expect(totalMembers(plan)).toBeLessThanOrEqual(100);
      // One admin: either you, or one of the fake players.
      expect(plan.viewerRole === "admin" || plan.fakeAdmin).toBe(true);
      expect(plan.viewerRole === "admin" && plan.fakeAdmin).toBe(false);
      if (plan.fakeAdmin) expect(plan.fakeMembers).toBeGreaterThanOrEqual(1);
      expect(plan.leagueName.startsWith("[Seed] ")).toBe(true);
    }
  });

  it("matches the documented sizes", () => {
    expect(totalMembers(planFor("league_empty")!)).toBe(1);
    expect(totalMembers(planFor("league_with_players")!)).toBe(12);
    expect(totalMembers(planFor("league_full")!)).toBe(100);
    expect(totalMembers(planFor("member_view")!)).toBe(12);
  });

  it("returns null for anything that is not a scenario", () => {
    fc.assert(
      fc.property(fc.anything(), (name) => {
        if (typeof name !== "string" || !names.includes(name)) {
          expect(planFor(name)).toBeNull();
        }
      }),
      { numRuns: 200 },
    );
    expect(planFor("__proto__")).toBeNull();
    expect(planFor("toString")).toBeNull();
  });
});
