import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  INVALID_DATE,
  formatDateTime,
  isoToLocalInput,
  localInputToIso,
} from "./dateTime";

const ISO = "2026-03-01T19:00:00.000Z";

describe("formatDateTime", () => {
  it("formats in a given zone", () => {
    expect(formatDateTime(ISO, { timeZone: "UTC", locale: "en-US" })).toBe(
      "Mar 1, 2026, 7:00 PM",
    );
    expect(
      formatDateTime(ISO, { timeZone: "America/Chicago", locale: "en-US" }),
    ).toBe("Mar 1, 2026, 1:00 PM");
  });

  it("can show the zone", () => {
    expect(
      formatDateTime(ISO, { timeZone: "UTC", locale: "en-US", showZone: true }),
    ).toBe("Mar 1, 2026, 7:00 PM UTC");
  });

  it("falls back on invalid input or zone", () => {
    expect(formatDateTime("nope")).toBe(INVALID_DATE);
    expect(formatDateTime(ISO, { timeZone: "Not/AZone" })).toBe(INVALID_DATE);
  });

  it("never throws and never returns an empty string", () => {
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(formatDateTime(raw).length).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });
});

describe("datetime-local helpers", () => {
  it("round-trips a local time", () => {
    const local = "2026-06-15T14:30";
    const iso = localInputToIso(local);
    expect(iso).not.toBeNull();
    expect(isoToLocalInput(iso as string)).toBe(local);
  });

  it("rejects empty and malformed values", () => {
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("2026-06-15")).toBeNull();
    expect(localInputToIso("not a date")).toBeNull();
    expect(isoToLocalInput("nope")).toBeNull();
  });

  it("round-trips for any mid-day time on a safe date", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2035 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 6, max: 20 }),
        fc.integer({ min: 0, max: 59 }),
        (y, mo, d, h, mi) => {
          const p = (n: number) => String(n).padStart(2, "0");
          const local = `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(mi)}`;
          const iso = localInputToIso(local);
          expect(iso).not.toBeNull();
          expect(isoToLocalInput(iso as string)).toBe(local);
        },
      ),
      { numRuns: 200 },
    );
  });
});
