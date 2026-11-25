import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { LeagueStatus } from "@/lib/leagues/types";
import { QUEUE_MAX, canAddToQueue, canEditQueue } from "./rules";

const status = fc.constantFrom<LeagueStatus>(
  "pre_draft",
  "drafting",
  "in_progress",
);

describe("queue rules", () => {
  it("editing is allowed only while pre_draft", () => {
    fc.assert(
      fc.property(status, (s) => {
        expect(canEditQueue({ status: s }).ok).toBe(s === "pre_draft");
      }),
      { numRuns: 50 },
    );
    expect(canEditQueue({ status: "drafting" })).toEqual({
      ok: false,
      reason: "league_not_pre_draft",
      status: 409,
    });
  });

  it("adding stops at exactly the limit", () => {
    expect(
      canAddToQueue({ status: "pre_draft", count: QUEUE_MAX - 1 }),
    ).toEqual({
      ok: true,
    });
    expect(canAddToQueue({ status: "pre_draft", count: QUEUE_MAX })).toEqual({
      ok: false,
      reason: "queue_full",
      status: 409,
    });
  });

  it("adding is allowed exactly when pre_draft and under the limit", () => {
    fc.assert(
      fc.property(status, fc.integer({ min: 0, max: 300 }), (s, count) => {
        expect(canAddToQueue({ status: s, count }).ok).toBe(
          s === "pre_draft" && count < QUEUE_MAX,
        );
      }),
      { numRuns: 200 },
    );
  });

  it("a started draft wins over a full queue", () => {
    expect(
      canAddToQueue({ status: "drafting", count: QUEUE_MAX }),
    ).toMatchObject({
      reason: "league_not_pre_draft",
    });
  });
});
