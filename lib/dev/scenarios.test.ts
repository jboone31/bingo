import fc from "fast-check";
import { parseCategory, parseSubmitter, parseText } from "@/lib/pool/fields";
import { describe, expect, it } from "vitest";
import {
  SCENARIOS,
  planFor,
  seedPoolRows,
  seedQueueOrder,
  totalMembers,
} from "./scenarios";

const names = Object.keys(SCENARIOS);

describe("scenarios", () => {
  it("has the F2, F3 and F4 scenarios", () => {
    expect([...names].sort()).toEqual([
      "league_empty",
      "league_full",
      "league_with_players",
      "league_with_pool",
      "member_view",
      "pool_ready",
      "queue_started",
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

  it("pool sizes match the documentation", () => {
    expect(planFor("league_with_pool")!.poolSubmissions).toBe(60);
    expect(planFor("pool_ready")!.poolSubmissions).toBe(300);
    expect(planFor("league_empty")!.poolSubmissions).toBe(0);
  });

  it("generates the planned rows with a few exact duplicates", () => {
    const rows = seedPoolRows(60);
    expect(rows).toHaveLength(60);
    expect(rows.length - new Set(rows.map((r) => r.text)).size).toBe(3);
    expect(rows.some((r) => r.submitter === "")).toBe(true);
    expect(rows.some((r) => r.category === "")).toBe(true);
    expect(new Set(rows.map((r) => r.category).filter(Boolean)).size).toBe(5);
  });

  it("generated rows always satisfy the pool field rules", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 400 }), (n) => {
        const rows = seedPoolRows(n);
        expect(rows).toHaveLength(n);
        for (const row of rows) {
          expect(parseText(row.text).ok).toBe(true);
          expect(parseSubmitter(row.submitter).ok).toBe(true);
          expect(parseCategory(row.category).ok).toBe(true);
        }
      }),
      { numRuns: 50 },
    );
  });

  it("queue sizes fit the pool and the 200 limit", () => {
    for (const name of names) {
      const plan = planFor(name)!;
      expect(plan.viewerQueueSize).toBeLessThanOrEqual(plan.poolSubmissions);
      expect(plan.fakeQueueSize).toBeLessThanOrEqual(plan.poolSubmissions);
      expect(plan.viewerQueueSize).toBeLessThanOrEqual(200);
    }
    const started = planFor("queue_started")!;
    expect(started.poolSubmissions).toBe(60);
    expect(started.viewerQueueSize).toBe(8);
    expect(started.fakeQueueSize).toBe(10);
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

describe("seedQueueOrder", () => {
  it("picks distinct in-range positions, the requested number of them", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 400 }),
        fc.integer({ min: 0, max: 250 }),
        fc.integer({ min: 0, max: 1000 }),
        (poolSize, size, salt) => {
          const order = seedQueueOrder(poolSize, size, salt);
          expect(order).toHaveLength(Math.min(size, poolSize));
          expect(new Set(order).size).toBe(order.length);
          for (const index of order) {
            expect(index).toBeGreaterThanOrEqual(0);
            expect(index).toBeLessThan(poolSize);
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("can take the whole pool, each square once", () => {
    const order = seedQueueOrder(60, 60, 5);
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 60 }, (_, i) => i),
    );
  });

  it("is deterministic, scrambled, and differs by salt", () => {
    expect(seedQueueOrder(60, 8, 0)).toEqual(seedQueueOrder(60, 8, 0));
    expect(seedQueueOrder(60, 8, 1)).not.toEqual(seedQueueOrder(60, 8, 2));
    const order = seedQueueOrder(60, 8, 3);
    expect(order).not.toEqual([...order].sort((a, b) => a - b));
  });

  it("returns nothing for an empty pool or size", () => {
    expect(seedQueueOrder(0, 5, 1)).toEqual([]);
    expect(seedQueueOrder(10, 0, 1)).toEqual([]);
  });
});
