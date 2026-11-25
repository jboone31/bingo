import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  SEED_POOL_SIZE,
  isSeedUser,
  parseSeedEmail,
  seedEmail,
  seedName,
} from "./seedIdentity";

describe("seed identity", () => {
  it("round-trips every pool number", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: SEED_POOL_SIZE }), (n) => {
        expect(parseSeedEmail(seedEmail(n))).toBe(n);
      }),
      { numRuns: 100 },
    );
  });

  it("formats names and emails", () => {
    expect(seedEmail(7)).toBe("seed-player-007@bingo-seed.test");
    expect(seedName(7)).toBe("Seed Player 007");
    expect(seedEmail(100)).toBe("seed-player-100@bingo-seed.test");
  });

  it("rejects numbers outside the pool", () => {
    for (const n of [0, 101, -1, 1.5, NaN]) {
      expect(() => seedEmail(n)).toThrow(RangeError);
    }
  });

  it.each([
    ["seed-player-001@gmail.com"],
    ["seed-player-101@bingo-seed.test"],
    ["seed-player-000@bingo-seed.test"],
    ["seed-player-1@bingo-seed.test"],
    ["real@bingo-seed.test"],
    ["xseed-player-001@bingo-seed.test"],
    ["seed-player-001@bingo-seed.test.evil.com"],
    ["SEED-PLAYER-001@BINGO-SEED.TEST"],
    [null],
    [42],
  ])("does not parse %j", (email) => {
    expect(parseSeedEmail(email)).toBeNull();
  });

  it("needs the seed flag in metadata as well as the email", () => {
    const email = seedEmail(3);
    expect(isSeedUser({ email, metadata: { seed: true } })).toBe(true);
    expect(isSeedUser({ email, metadata: {} })).toBe(false);
    expect(isSeedUser({ email, metadata: { seed: "true" } })).toBe(false);
    expect(isSeedUser({ email, metadata: null })).toBe(false);
    expect(isSeedUser({ email: "a@b.com", metadata: { seed: true } })).toBe(
      false,
    );
  });

  it("a user is never a seed user unless both checks pass", () => {
    fc.assert(
      fc.property(fc.emailAddress(), fc.boolean(), (email, flag) => {
        if (!email.endsWith("@bingo-seed.test")) {
          expect(isSeedUser({ email, metadata: { seed: flag } })).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });
});
