import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  autoChoice,
  nextDeadline,
  onClock,
  settle,
  totalPicks,
  userOnClock,
  type ModelLeague,
} from "./engine";

function seeded(seed: number) {
  let a = seed >>> 0;
  return (max: number) => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
  };
}

describe("onClock", () => {
  it("snakes: 1..k, then k..1", () => {
    const order = Array.from(
      { length: 8 },
      (_, i) => onClock(i + 1, 4).position,
    );
    expect(order).toEqual([1, 2, 3, 4, 4, 3, 2, 1]);
    expect(onClock(9, 4)).toEqual({ round: 3, position: 1 });
    expect(onClock(1, 1)).toEqual({ round: 1, position: 1 });
    expect(onClock(25, 1)).toEqual({ round: 25, position: 1 });
  });

  it("visits every position once per round, ascending on odd rounds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 25 }),
        (size, round) => {
          const picks = Array.from({ length: size }, (_, i) =>
            onClock((round - 1) * size + i + 1, size),
          );
          expect(picks.every((p) => p.round === round)).toBe(true);
          const positions = picks.map((p) => p.position);
          const ascending = Array.from({ length: size }, (_, i) => i + 1);
          expect(positions).toEqual(
            round % 2 === 1 ? ascending : [...ascending].reverse(),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it("totalPicks is 25 per player", () => {
    expect(totalPicks(5)).toBe(125);
  });
});

describe("nextDeadline", () => {
  const base = { at: 100_000, deadline: 90_000, pickSeconds: 60 };
  it("restarts from the pick for manual and bot picks", () => {
    expect(nextDeadline({ ...base, kind: "manual" })).toBe(160_000);
    expect(nextDeadline({ ...base, kind: "bot" })).toBe(160_000);
  });
  it("keeps the schedule for an auto-pick after a missed deadline", () => {
    expect(nextDeadline({ ...base, kind: "auto" })).toBe(150_000);
  });
});

describe("autoChoice", () => {
  it("takes the first untaken queued square, else a random untaken pool square", () => {
    const taken = new Set(["a", "b"]);
    expect(
      autoChoice(["a", "c", "d"], taken, ["a", "b", "c", "d"], () => 0),
    ).toBe("c");
    expect(autoChoice(["a"], taken, ["a", "b", "c", "d"], () => 1)).toBe("d");
    expect(autoChoice([], new Set(["x"]), ["x"], () => 0)).toBeNull();
  });
});

/** A league whose every deadline has passed long ago (or not, per `expired`). */
function arbLeague() {
  return fc
    .record({
      sizes: fc.array(fc.integer({ min: 1, max: 4 }), {
        minLength: 1,
        maxLength: 3,
      }),
      extraPool: fc.integer({ min: 0, max: 20 }),
      seed: fc.integer(),
      queueLen: fc.integer({ min: 0, max: 30 }),
      botMask: fc.integer({ min: 0, max: 1023 }),
      expired: fc.array(fc.boolean(), { minLength: 3, maxLength: 3 }),
    })
    .map(({ sizes, extraPool, seed, queueLen, botMask, expired }) => {
      const rand = seeded(seed);
      const biggest = Math.max(...sizes);
      const pool = Array.from(
        { length: biggest * 25 + extraPool },
        (_, i) => `s${i}`,
      );
      let u = 0;
      const groups = sizes.map((size, gi) => ({
        order: Array.from({ length: size }, () => `u${u++}`),
        picks: [],
        nextPick: 1,
        deadline: expired[gi] ? 0 : 10_000_000,
      }));
      const users = groups.flatMap((g) => g.order);
      const queues: Record<string, string[]> = {};
      for (const user of users) {
        queues[user] = Array.from(
          { length: queueLen },
          () => pool[rand(pool.length)],
        ).filter((v, i, a) => a.indexOf(v) === i);
      }
      const bots = new Set(users.filter((_, i) => (botMask >> i) & 1));
      const league: ModelLeague = {
        pickSeconds: 60,
        pool,
        queues,
        groups,
        bots,
        completed: false,
      };
      return { league, seed };
    });
}

describe("settle (model)", () => {
  it("terminates, never repeats a square in a group, picks for the user on the clock, and leaves nothing due", () => {
    fc.assert(
      fc.property(arbLeague(), ({ league, seed }) => {
        const now = 1000;
        const { league: after } = settle(league, now, seeded(seed));
        for (const g of after.groups) {
          const squares = g.picks.map((p) => p.submissionId);
          expect(new Set(squares).size).toBe(squares.length);
          g.picks.forEach((p, i) => {
            expect(p.pickNumber).toBe(i + 1);
            const pos = onClock(p.pickNumber, g.order.length).position;
            expect(p.userId).toBe(g.order[pos - 1]);
          });
          const user = userOnClock(g);
          if (user !== null) {
            expect(g.deadline! > now && !league.bots.has(user)).toBe(true);
          }
          // Picked squares are out of every queue in the group.
          for (const member of g.order) {
            for (const s of squares)
              expect(after.queues[member]).not.toContain(s);
          }
        }
        // Settling again changes nothing.
        expect(settle(after, now, seeded(seed)).picks).toBe(0);
      }),
      { numRuns: 150 },
    );
  });

  it("with everyone a bot, every group finishes with 25 picks per player", () => {
    fc.assert(
      fc.property(arbLeague(), ({ league, seed }) => {
        const all = new Set(league.groups.flatMap((g) => g.order));
        const { league: after } = settle(
          { ...league, bots: all },
          1000,
          seeded(seed),
        );
        expect(after.completed).toBe(true);
        for (const g of after.groups) {
          expect(g.picks).toHaveLength(totalPicks(g.order.length));
          for (const user of g.order) {
            expect(g.picks.filter((p) => p.userId === user)).toHaveLength(25);
          }
          expect(g.deadline).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  it("auto-picks from the queue first and cascades over missed turns", () => {
    const league: ModelLeague = {
      pickSeconds: 60,
      pool: Array.from({ length: 50 }, (_, i) => `s${i}`),
      queues: { a: ["s9", "s3"], b: ["s9", "s4"] },
      // Missed 61 s ago: pick 1 is due, its follow-up deadline (1 s ago) is due too,
      // and the third lands 59 s from now.
      groups: [
        { order: ["a", "b"], picks: [], nextPick: 1, deadline: -61_000 },
      ],
      bots: new Set(),
      completed: false,
    };
    const { league: after, picks } = settle(league, 0, () => 0);
    expect(picks).toBe(2);
    const g = after.groups[0];
    expect(g.picks[0]).toMatchObject({ userId: "a", submissionId: "s9" });
    expect(g.picks[1]).toMatchObject({ userId: "b", submissionId: "s4" });
    expect(g.deadline).toBe(59_000);
    expect(after.queues.b).not.toContain("s9");
  });
});
