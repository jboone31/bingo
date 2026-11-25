import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PAGE_SIZE } from "./limits";
import { clampPage, pageCountFor, rangeFor } from "./paging";

describe("paging", () => {
  it("counts pages, with at least one", () => {
    expect(pageCountFor(0)).toBe(1);
    expect(pageCountFor(1)).toBe(1);
    expect(pageCountFor(PAGE_SIZE)).toBe(1);
    expect(pageCountFor(PAGE_SIZE + 1)).toBe(2);
  });

  it("clamps junk to a valid page", () => {
    expect(clampPage(undefined, 3)).toBe(1);
    expect(clampPage("abc", 3)).toBe(1);
    expect(clampPage("0", 3)).toBe(1);
    expect(clampPage("-2", 3)).toBe(1);
    expect(clampPage("2", 3)).toBe(2);
    expect(clampPage("99", 3)).toBe(3);
    expect(clampPage(["2"], 3)).toBe(1);
  });

  it("clampPage always lands in 1..pageCount", () => {
    fc.assert(
      fc.property(
        fc.anything(),
        fc.integer({ min: 1, max: 200 }),
        (raw, count) => {
          const page = clampPage(raw, count);
          expect(page).toBeGreaterThanOrEqual(1);
          expect(page).toBeLessThanOrEqual(count);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("ranges tile the rows with no gaps or overlaps", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (page) => {
        const { from, to } = rangeFor(page);
        expect(to - from + 1).toBe(PAGE_SIZE);
        expect(rangeFor(page + 1).from).toBe(to + 1);
      }),
      { numRuns: 100 },
    );
  });
});
