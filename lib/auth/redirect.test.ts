import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { safeNext } from "./redirect";

describe("safeNext", () => {
  it.each([
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["javascript:alert(1)", "/"],
    ["/ok\nx", "/"],
    ["", "/"],
    [null, "/"],
    [undefined, "/"],
    ["leagues", "/"],
    ["/leagues?a=1", "/leagues?a=1"],
    ["/", "/"],
  ])("%j -> %j", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it("always returns a same-origin path starting with a single slash", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const out = safeNext(raw);
        expect(out.startsWith("/")).toBe(true);
        expect(out.startsWith("//")).toBe(false);
        expect(new URL(out, "http://localhost").origin).toBe(
          "http://localhost",
        );
      }),
      { numRuns: 200 },
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(safeNext(safeNext(raw))).toBe(safeNext(raw));
      }),
      { numRuns: 200 },
    );
  });
});
