import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseDraftAt } from "./draftAt";

describe("parseDraftAt", () => {
  it("treats missing as not set", () => {
    expect(parseDraftAt(undefined)).toEqual({ ok: true, value: null });
    expect(parseDraftAt(null)).toEqual({ ok: true, value: null });
  });

  it("normalizes to a UTC ISO string", () => {
    expect(parseDraftAt("2026-03-01T13:00:00-06:00")).toEqual({
      ok: true,
      value: "2026-03-01T19:00:00.000Z",
    });
  });

  it("allows past dates", () => {
    expect(parseDraftAt("2020-01-01T00:00:00Z").ok).toBe(true);
  });

  it.each([[""], ["  "], ["nope"], [123], [{}], ["1900-01-01T00:00:00Z"]])(
    "rejects %j",
    (input) => {
      expect(parseDraftAt(input)).toEqual({
        ok: false,
        reason: "invalid_draft_at",
      });
    },
  );

  it("any accepted string value is a valid ISO string", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        const result = parseDraftAt(raw);
        if (result.ok && result.value !== null) {
          expect(new Date(result.value).toISOString()).toBe(result.value);
        }
      }),
      { numRuns: 200 },
    );
  });
});
