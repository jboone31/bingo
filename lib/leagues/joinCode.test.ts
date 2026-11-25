import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  JOIN_CODE_ALPHABET,
  JOIN_CODE_LENGTH,
  formatJoinCode,
  generateJoinCode,
  normalizeJoinCode,
} from "./joinCode";

const randomCode = fc
  .array(fc.integer({ min: 0, max: JOIN_CODE_ALPHABET.length - 1 }), {
    minLength: JOIN_CODE_LENGTH,
    maxLength: JOIN_CODE_LENGTH,
  })
  .map((indexes) => {
    let i = 0;
    return generateJoinCode(() => indexes[i++]);
  });

describe("join codes", () => {
  it("has no look-alike characters", () => {
    for (const bad of "01OIL") {
      expect(JOIN_CODE_ALPHABET).not.toContain(bad);
    }
    expect(JOIN_CODE_ALPHABET).toHaveLength(31);
  });

  it("generated codes are 8 alphabet characters that normalize to themselves", () => {
    fc.assert(
      fc.property(randomCode, (code) => {
        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
        expect(normalizeJoinCode(code)).toBe(code);
      }),
      { numRuns: 200 },
    );
  });

  it("normalize ignores case, hyphens and spaces", () => {
    fc.assert(
      fc.property(randomCode, fc.boolean(), (code, lower) => {
        const shown = formatJoinCode(code);
        const typed = lower ? shown.toLowerCase() : shown;
        expect(normalizeJoinCode(` ${typed.replace("-", " - ")} `)).toBe(code);
      }),
      { numRuns: 200 },
    );
  });

  it.each([
    ["K7P2QX9"],
    ["K7P2QX9MM"],
    ["K7P2QX90"],
    ["K7P2QXOM"],
    ["K7P2QX1M"],
    ["K7P2QXIM"],
    ["K7P2QXLM"],
    [""],
    [null],
    [42],
  ])("rejects %j", (raw) => {
    expect(normalizeJoinCode(raw)).toBeNull();
  });

  it("formats with a hyphen in the middle", () => {
    expect(formatJoinCode("K7P2QX9M")).toBe("K7P2-QX9M");
  });
});
