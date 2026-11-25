import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  displayCategory,
  displaySubmitter,
  parseCategory,
  parseSubmitter,
  parseText,
} from "./fields";

describe("parseText", () => {
  it("trims and accepts 1 to 200 code points", () => {
    expect(parseText("  Team X wins  ")).toEqual({
      ok: true,
      value: "Team X wins",
    });
    expect(parseText("🎲".repeat(200)).ok).toBe(true);
    expect(parseText("🎲".repeat(201)).ok).toBe(false);
  });

  it.each([[""], ["   "], ["a\nb"], [5], [null], [undefined]])(
    "rejects %j",
    (input) => {
      expect(parseText(input)).toEqual({ ok: false, reason: "invalid_text" });
    },
  );

  it("any accepted value is trimmed, 1 to 200 code points, no control chars", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (raw) => {
        const result = parseText(raw);
        if (result.ok) {
          expect(result.value).toBe(result.value.trim());
          const n = [...result.value].length;
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(200);
          expect(/[\u0000-\u001f\u007f-\u009f]/.test(result.value)).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe("parseSubmitter", () => {
  it("allows empty and missing", () => {
    expect(parseSubmitter("")).toEqual({ ok: true, value: "" });
    expect(parseSubmitter(undefined)).toEqual({ ok: true, value: "" });
    expect(parseSubmitter(null)).toEqual({ ok: true, value: "" });
  });

  it("limits to 60 and rejects control characters and non-strings", () => {
    expect(parseSubmitter("a".repeat(60)).ok).toBe(true);
    expect(parseSubmitter("a".repeat(61)).ok).toBe(false);
    expect(parseSubmitter("a\tb").ok).toBe(false);
    expect(parseSubmitter(5)).toEqual({
      ok: false,
      reason: "invalid_submitter",
    });
  });
});

describe("parseCategory", () => {
  it("collapses whitespace and keeps capitalization", () => {
    expect(parseCategory("  Pop   Culture ")).toEqual({
      ok: true,
      value: "Pop Culture",
    });
  });

  it("allows empty, limits to 40, rejects non-strings", () => {
    expect(parseCategory("")).toEqual({ ok: true, value: "" });
    expect(parseCategory("a".repeat(40)).ok).toBe(true);
    expect(parseCategory("a".repeat(41)).ok).toBe(false);
    expect(parseCategory(5)).toEqual({ ok: false, reason: "invalid_category" });
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const first = parseCategory(raw);
        if (first.ok) {
          expect(parseCategory(first.value)).toEqual(first);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe("display fallbacks", () => {
  it("fills blanks", () => {
    expect(displaySubmitter("")).toBe("Unknown");
    expect(displaySubmitter("Sam")).toBe("Sam");
    expect(displayCategory("")).toBe("Uncategorized");
    expect(displayCategory("Sports")).toBe("Sports");
  });
});
