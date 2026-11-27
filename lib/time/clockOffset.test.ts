import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bestEstimate, estimateOffset, MAX_RTT_MS } from "./clockOffset";

describe("estimateOffset", () => {
  it("uses the round-trip midpoint", () => {
    expect(
      estimateOffset({ sentAt: 1000, receivedAt: 1100, serverNow: 5050 }),
    ).toEqual({ offsetMs: 4000, rttMs: 100 });
  });

  it("rejects negative, huge and non-finite round trips", () => {
    expect(
      estimateOffset({ sentAt: 10, receivedAt: 5, serverNow: 0 }),
    ).toBeNull();
    expect(
      estimateOffset({ sentAt: 0, receivedAt: MAX_RTT_MS + 1, serverNow: 0 }),
    ).toBeNull();
    expect(
      estimateOffset({ sentAt: 0, receivedAt: Number.NaN, serverNow: 0 }),
    ).toBeNull();
  });

  it("is exact when the trip is symmetric, for any fixed server offset", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2_000_000_000 }),
        fc.integer({ min: 0, max: 2000 }),
        fc.integer({ min: -10_000_000, max: 10_000_000 }),
        (sentAt, half, offset) => {
          const received = sentAt + 2 * half;
          const serverNow = sentAt + half + offset;
          const estimate = estimateOffset({
            sentAt,
            receivedAt: received,
            serverNow,
          });
          expect(estimate?.offsetMs).toBe(offset);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("bestEstimate", () => {
  it("returns null with no usable sample", () => {
    expect(bestEstimate([])).toBeNull();
    expect(
      bestEstimate([{ sentAt: 5, receivedAt: 1, serverNow: 0 }]),
    ).toBeNull();
  });

  it("keeps the sample with the shortest round trip", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: MAX_RTT_MS }), {
          minLength: 1,
          maxLength: 10,
        }),
        (rtts) => {
          const samples = rtts.map((rtt, i) => ({
            sentAt: i * 10_000,
            receivedAt: i * 10_000 + rtt,
            serverNow: i * 10_000,
          }));
          expect(bestEstimate(samples)?.rttMs).toBe(Math.min(...rtts));
        },
      ),
      { numRuns: 100 },
    );
  });
});
