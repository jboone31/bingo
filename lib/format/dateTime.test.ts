import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  INVALID_DATE,
  formatDateTime,
  formatUtcStable,
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

describe("formatUtcStable", () => {
  it("formats a UTC timestamp the same way everywhere", () => {
    expect(formatUtcStable("2026-12-02T18:58:53.641+00:00")).toBe(
      "Dec 2, 2026, 6:58 PM UTC",
    );
    expect(formatUtcStable("2026-03-01T00:05:00Z")).toBe(
      "Mar 1, 2026, 12:05 AM UTC",
    );
    expect(formatUtcStable("2026-03-01T12:00:00Z")).toBe(
      "Mar 1, 2026, 12:00 PM UTC",
    );
  });

  it("matches the Intl output apart from the separator", () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date("2001-01-01"),
          max: new Date("2099-12-31"),
          noInvalidDate: true,
        }),
        (date) => {
          const iso = date.toISOString();
          const intl = formatDateTime(iso, {
            timeZone: "UTC",
            locale: "en-US",
            showZone: true,
          }).replace(" at ", ", ");
          expect(formatUtcStable(iso)).toBe(intl);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("falls back on invalid input and never throws", () => {
    expect(formatUtcStable("nope")).toBe(INVALID_DATE);
    fc.assert(
      fc.property(fc.string(), (raw) => {
        expect(formatUtcStable(raw).length).toBeGreaterThan(0);
      }),
      { numRuns: 200 },
    );
  });
});
