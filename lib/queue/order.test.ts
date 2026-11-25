import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isPermutation, moveById, moveItem, sameOrder } from "./order";

const ids = fc.uniqueArray(fc.uuid(), { minLength: 0, maxLength: 30 });

describe("moveItem", () => {
  it("moves forward and backward", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("clamps the target and ignores a bad source", () => {
    expect(moveItem(["a", "b", "c"], 0, 99)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b", "c"], 2, -5)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("does not change its input", () => {
    const input = ["a", "b", "c"];
    moveItem(input, 0, 2);
    expect(input).toEqual(["a", "b", "c"]);
  });

  it("always keeps the same ids", () => {
    fc.assert(
      fc.property(
        ids,
        fc.integer({ min: -5, max: 40 }),
        fc.integer({ min: -5, max: 40 }),
        (list, from, to) => {
          expect(isPermutation(moveItem(list, from, to), list)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("moving there and back restores the order", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.uuid(), { minLength: 1, maxLength: 30 }),
        fc.nat(29),
        fc.nat(29),
        (list, a, b) => {
          const from = a % list.length;
          const to = b % list.length;
          const moved = moveItem(list, from, to);
          expect(moveItem(moved, to, from)).toEqual(list);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("moveById", () => {
  it("moves one step and stops at the ends", () => {
    expect(moveById(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveById(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveById(["a", "b", "c"], "a", -1)).toEqual(["a", "b", "c"]);
    expect(moveById(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveById(["a", "b"], "zzz", 1)).toEqual(["a", "b"]);
  });
});

describe("isPermutation and sameOrder", () => {
  it("requires the same ids exactly once", () => {
    expect(isPermutation(["a", "b"], ["b", "a"])).toBe(true);
    expect(isPermutation(["a", "b"], ["a", "a"])).toBe(false);
    expect(isPermutation(["a", "a"], ["a", "a"])).toBe(false);
    expect(isPermutation(["a"], ["a", "b"])).toBe(false);
    expect(isPermutation([], [])).toBe(true);
  });

  it("sameOrder compares position by position", () => {
    expect(sameOrder(["a", "b"], ["a", "b"])).toBe(true);
    expect(sameOrder(["a", "b"], ["b", "a"])).toBe(false);
  });
});
