import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseDisplayName } from "./displayName";

describe("parseDisplayName", () => {
  it("trims a valid name", () => {
    expect(parseDisplayName("  Ada  ")).toEqual({ ok: true, value: "Ada" });
  });

  it("accepts emoji by code point count", () => {
    expect(parseDisplayName("🎲".repeat(40)).ok).toBe(true);
    expect(parseDisplayName("🎲".repeat(41)).ok).toBe(false);
  });

  it.each([
    [""],
    ["   "],
    ["a".repeat(41)],
    ["a\nb"],
    [42],
    [null],
    [undefined],
  ])("rejects %j", (input) => {
    expect(parseDisplayName(input)).toEqual({
      ok: false,
      reason: "invalid_display_name",
    });
  });

  it("any accepted value is trimmed, 1 to 40 code points, no control chars", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (raw) => {
        const result = parseDisplayName(raw);
        if (result.ok) {
          expect(result.value).toBe(result.value.trim());
          const n = [...result.value].length;
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(40);

          expect(/[\u0000-\u001f\u007f-\u009f]/.test(result.value)).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });
});
