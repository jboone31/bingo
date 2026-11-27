import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { groupSizes, requiredPool, startGate } from "./gate";
import { canChangeDraftSettings, canStart } from "./rules";
import { formatSeconds, parseGroupCount, parsePickSeconds } from "./settings";
import { splitIntoGroups } from "./split";

/** A small seeded generator (mulberry32) for repeatable shuffles. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return (max: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return Math.floor(r * max);
  };
}

describe("settings", () => {
  it("accepts exactly the integers in range", () => {
    fc.assert(
      fc.property(fc.integer({ min: -50, max: 1000 }), (n) => {
        expect(parseGroupCount(n).ok).toBe(n >= 1 && n <= 10);
        expect(parsePickSeconds(n).ok).toBe(n >= 10 && n <= 900);
      }),
      { numRuns: 300 },
    );
  });

  it("refuses strings, fractions and other types", () => {
    for (const bad of ["3", 2.5, null, undefined, NaN, Infinity, true, {}]) {
      expect(parseGroupCount(bad).ok).toBe(false);
      expect(parsePickSeconds(bad).ok).toBe(false);
    }
  });

  it("formats seconds as minutes and seconds", () => {
    expect(formatSeconds(45)).toBe("45 s");
    expect(formatSeconds(60)).toBe("1 min");
    expect(formatSeconds(150)).toBe("2 min 30 s");
    expect(formatSeconds(900)).toBe("15 min");
    expect(formatSeconds(-1)).toBe("");
  });
});

describe("gate", () => {
  it("matches the draft-rules examples", () => {
    expect(requiredPool(15, 1)).toBe(375);
    expect(requiredPool(15, 3)).toBe(125);
    expect(groupSizes(15, 4)).toEqual([4, 4, 4, 3]);
  });

  it("never needs more as groups grow", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 9 }),
        (n, g) => {
          expect(requiredPool(n, g + 1)).toBeLessThanOrEqual(
            requiredPool(n, g),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it("gives g balanced sizes that sum to n", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        (n, g) => {
          const sizes = groupSizes(n, g);
          expect(sizes).toHaveLength(g);
          expect(sizes.reduce((a, b) => a + b, 0)).toBe(n);
          expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(
            1,
          );
          expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("is ok exactly when there are enough players and squares", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 3000 }),
        (members, groups, pool) => {
          const gate = startGate({ members, groups, pool });
          const expected =
            members >= 1 &&
            members >= groups &&
            pool >= requiredPool(members, groups);
          expect(gate.ok).toBe(expected);
          if (!gate.ok && (members < 1 || members < groups)) {
            expect(gate.reason).toBe("too_few_players");
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("reports how many squares are needed", () => {
    expect(startGate({ members: 15, groups: 1, pool: 100 })).toEqual({
      ok: false,
      reason: "pool_too_small",
      needed: 375,
    });
  });
});

describe("splitIntoGroups", () => {
  it("puts everyone in exactly one group with positions 1..size", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer(),
        (n, g, seed) => {
          fc.pre(n >= g);
          const ids = Array.from({ length: n }, (_, i) => `u${i}`);
          const plan = splitIntoGroups(ids, g, seeded(seed));
          expect(plan.map((p) => p.number)).toEqual(
            Array.from({ length: g }, (_, i) => i + 1),
          );
          expect(plan.map((p) => p.members.length)).toEqual(groupSizes(n, g));
          const all = plan.flatMap((p) => p.members.map((m) => m.userId));
          expect([...all].sort()).toEqual([...ids].sort());
          for (const p of plan) {
            expect(p.members.map((m) => m.position)).toEqual(
              p.members.map((_, i) => i + 1),
            );
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("depends on the random source and does not change its input", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `u${i}`);
    const copy = [...ids];
    const a = splitIntoGroups(ids, 2, seeded(1));
    const b = splitIntoGroups(ids, 2, seeded(2));
    expect(ids).toEqual(copy);
    expect(a).not.toEqual(b);
    expect(splitIntoGroups(ids, 2, seeded(1))).toEqual(a);
  });

  it("can put anyone first", () => {
    const ids = ["a", "b", "c", "d"];
    const firsts = new Set<string>();
    for (let seed = 0; seed < 200; seed += 1) {
      firsts.add(splitIntoGroups(ids, 1, seeded(seed))[0].members[0].userId);
    }
    expect(firsts).toEqual(new Set(ids));
  });
});

describe("rules", () => {
  const base = {
    status: "pre_draft" as const,
    actorRole: "admin" as const,
    members: 15,
    groups: 3,
    pool: 125,
    expected: { members: 15, groupCount: 3 },
  };

  it("lets the admin change settings only while pre_draft", () => {
    expect(
      canChangeDraftSettings({ status: "pre_draft", actorRole: "admin" }),
    ).toEqual({ ok: true });
    expect(
      canChangeDraftSettings({ status: "pre_draft", actorRole: "member" }),
    ).toMatchObject({ reason: "not_admin", status: 403 });
    expect(
      canChangeDraftSettings({ status: "drafting", actorRole: "admin" }),
    ).toMatchObject({ reason: "league_not_pre_draft", status: 409 });
  });

  it("starts when everything checks out", () => {
    expect(canStart(base)).toEqual({ kind: "start" });
  });

  it("refuses a non-admin in any status", () => {
    expect(canStart({ ...base, actorRole: "member" })).toMatchObject({
      reason: "not_admin",
    });
    expect(
      canStart({ ...base, actorRole: "member", status: "drafting" }),
    ).toMatchObject({ reason: "not_admin" });
  });

  it("treats a started league as already started for the admin", () => {
    expect(canStart({ ...base, status: "drafting" })).toEqual({
      kind: "already_started",
    });
    expect(canStart({ ...base, status: "in_progress", pool: 0 })).toEqual({
      kind: "already_started",
    });
  });

  it("refuses when the confirmed numbers are out of date", () => {
    expect(canStart({ ...base, members: 16 })).toMatchObject({
      reason: "draft_setup_changed",
    });
    expect(
      canStart({ ...base, expected: { members: 15, groupCount: 2 } }),
    ).toMatchObject({ reason: "draft_setup_changed" });
  });

  it("refuses too few players and too small a pool", () => {
    expect(
      canStart({
        ...base,
        members: 2,
        expected: { members: 2, groupCount: 3 },
      }),
    ).toMatchObject({ reason: "too_few_players", status: 409 });
    expect(canStart({ ...base, pool: 124 })).toMatchObject({
      reason: "pool_too_small",
      status: 409,
    });
  });
});
