import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseLeagueName } from "./name";

describe("parseLeagueName", () => {
  it("trims a valid name", () => {
    expect(parseLeagueName("  Office 2026 ")).toEqual({
      ok: true,
      value: "Office 2026",
    });
  });

  it("counts code points", () => {
    expect(parseLeagueName("🎲".repeat(60)).ok).toBe(true);
    expect(parseLeagueName("🎲".repeat(61)).ok).toBe(false);
  });

  it.each([
    [""],
    ["   "],
    ["a".repeat(61)],
    ["a\tb"],
    [1],
    [null],
    [undefined],
  ])("rejects %j", (input) => {
    expect(parseLeagueName(input)).toEqual({
      ok: false,
      reason: "invalid_name",
    });
  });

  it("any accepted value is trimmed and 1 to 60 code points", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (raw) => {
        const result = parseLeagueName(raw);
        if (result.ok) {
          expect(result.value).toBe(result.value.trim());
          const n = [...result.value].length;
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(60);
          expect(/[\u0000-\u001f\u007f-\u009f]/.test(result.value)).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });
});
