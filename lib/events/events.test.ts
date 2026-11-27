import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { catchUpPlan } from "./catchUp";
import { describeEvent } from "./describe";
import { EMPTY_STATE, foldEvents, stateFromInitial } from "./fold";
import {
  adminTransferred,
  cleanName,
  draftDateChanged,
  joinCodeRegenerated,
  memberJoined,
  memberLeft,
  memberRemoved,
  poolChanged,
} from "./payload";
import { eventFromRow } from "./rows";
import { MAX_PAYLOAD_BYTES, type LeagueEvent } from "./types";

const ev = (seq: number, type = "pool_changed"): LeagueEvent => ({
  id: `id-${seq}`,
  leagueId: "league",
  seq,
  type,
  payload: {},
  actorId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
});
const seqs = (events: readonly LeagueEvent[]) => events.map((e) => e.seq);

describe("foldEvents", () => {
  it("starts empty with no gap", () => {
    expect(EMPTY_STATE).toMatchObject({ lastSeq: 0, hasGap: false });
  });

  it("orders events and advances over a contiguous run", () => {
    const state = foldEvents(EMPTY_STATE, [ev(2), ev(1), ev(3)]);
    expect(seqs(state.events)).toEqual([1, 2, 3]);
    expect(state).toMatchObject({ lastSeq: 3, hasGap: false });
  });

  it("applies a duplicate once", () => {
    const state = foldEvents(foldEvents(EMPTY_STATE, [ev(1), ev(2)]), [
      ev(2),
      ev(1),
    ]);
    expect(seqs(state.events)).toEqual([1, 2]);
  });

  it("flags a hole and stops lastSeq before it", () => {
    const state = foldEvents(EMPTY_STATE, [ev(1), ev(2), ev(5)]);
    expect(state).toMatchObject({ lastSeq: 2, hasGap: true });
  });

  it("clears the gap once the missing events arrive", () => {
    const gap = foldEvents(EMPTY_STATE, [ev(1), ev(4)]);
    const filled = foldEvents(gap, [ev(3), ev(2)]);
    expect(filled).toMatchObject({ lastSeq: 4, hasGap: false });
  });

  it("treats a first event above 1 as a gap when the log was empty", () => {
    expect(foldEvents(EMPTY_STATE, [ev(3)])).toMatchObject({
      lastSeq: 0,
      hasGap: true,
    });
  });

  it("does not count history older than a capped first load as a gap", () => {
    const state = stateFromInitial([ev(60), ev(58), ev(59)]);
    expect(state).toMatchObject({ baseSeq: 57, lastSeq: 60, hasGap: false });
    expect(foldEvents(state, [ev(61)])).toMatchObject({
      lastSeq: 61,
      hasGap: false,
    });
  });

  it("ignores events at or below the base", () => {
    const state = stateFromInitial([ev(10), ev(11)]);
    expect(seqs(foldEvents(state, [ev(3)]).events)).toEqual([10, 11]);
  });

  it("gives the same result for any order and duplication of the same events", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 40 }), {
          minLength: 0,
          maxLength: 25,
        }),
        fc.nat(),
        (numbers, seed) => {
          const events = numbers.map((n) => ev(n));
          const doubled = [...events, ...events];
          const shuffled = [...doubled].sort(
            (a, b) => ((a.seq * 31 + seed) % 7) - ((b.seq * 31 + seed) % 7),
          );
          const a = foldEvents(EMPTY_STATE, events);
          const b = foldEvents(EMPTY_STATE, shuffled);
          expect(seqs(b.events)).toEqual(seqs(a.events));
          expect(b.lastSeq).toBe(a.lastSeq);
          expect(b.hasGap).toBe(a.hasGap);
        },
      ),
      { numRuns: 150 },
    );
  });

  it("never lets lastSeq pass a hole, and has no gap only when contiguous", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 30 }), {
          minLength: 1,
          maxLength: 20,
        }),
        (numbers) => {
          const state = foldEvents(
            EMPTY_STATE,
            numbers.map((n) => ev(n)),
          );
          const held = new Set(numbers);
          for (let s = 1; s <= state.lastSeq; s += 1)
            expect(held.has(s)).toBe(true);
          expect(held.has(state.lastSeq + 1)).toBe(false);
          const contiguous = Math.max(...numbers) === state.lastSeq;
          expect(state.hasGap).toBe(!contiguous);
        },
      ),
      { numRuns: 150 },
    );
  });
});

describe("catchUpPlan", () => {
  it("reads from the first missing seq when there is a gap", () => {
    const state = foldEvents(EMPTY_STATE, [ev(1), ev(2), ev(6)]);
    expect(catchUpPlan(state, false)).toEqual({ afterSeq: 2 });
  });

  it("reads nothing when nothing is missing and no recheck is forced", () => {
    expect(catchUpPlan(foldEvents(EMPTY_STATE, [ev(1)]), false)).toBeNull();
  });

  it("reads after the last seq when forced", () => {
    expect(catchUpPlan(foldEvents(EMPTY_STATE, [ev(1), ev(2)]), true)).toEqual({
      afterSeq: 2,
    });
    expect(catchUpPlan(EMPTY_STATE, true)).toEqual({ afterSeq: 0 });
  });
});

describe("describeEvent", () => {
  const text = (type: string, payload: Record<string, unknown> = {}) =>
    describeEvent({ type, payload });

  it("describes each known type", () => {
    expect(text("member_joined", { name: "Sam" })).toBe(
      "Sam joined the league",
    );
    expect(text("member_left", { name: "Sam" })).toBe("Sam left the league");
    expect(text("member_removed", { name: "Sam" })).toBe(
      "Sam was removed from the league",
    );
    expect(text("admin_transferred", { from: "Alex", to: "Sam" })).toBe(
      "Alex made Sam the admin",
    );
    expect(
      text("draft_date_changed", { draftAt: "2026-02-01T00:00:00Z" }),
    ).toBe("The draft date was changed");
    expect(text("draft_date_changed", { draftAt: null })).toBe(
      "The draft date was cleared",
    );
    expect(text("join_code_regenerated")).toBe("The join code was regenerated");
    expect(text("pool_changed", { kind: "imported", count: 12 })).toBe(
      "12 squares imported into the pool",
    );
    expect(text("pool_changed", { kind: "added", count: 1 })).toBe(
      "1 square added to the pool",
    );
    expect(text("pool_changed", { kind: "cleared", count: 30 })).toBe(
      "Pool cleared (30 squares removed)",
    );
  });

  it("describes the draft events", () => {
    expect(
      text("draft_settings_changed", { groupCount: 3, pickSeconds: 90 }),
    ).toBe("Draft settings changed: 3 groups, 1 min 30 s per pick");
    expect(
      text("draft_settings_changed", { groupCount: 1, pickSeconds: 60 }),
    ).toBe("Draft settings changed: 1 group, 1 min per pick");
    expect(text("draft_settings_changed", { groupCount: "x" })).toBe(
      "The draft settings changed",
    );
    expect(text("draft_started", { groupCount: 3, sizes: [5, 5, 5] })).toBe(
      "The draft started with 3 groups",
    );
    expect(text("draft_started", { groupCount: 1 })).toBe("The draft started");
    expect(text("draft_started", {})).toBe("The draft started");
  });

  it("falls back for unknown types and bad payloads", () => {
    expect(text("draft_pick_made")).toBe("Something changed");
    expect(text("member_joined", { name: 5 })).toBe(
      "Someone joined the league",
    );
    expect(text("pool_changed", { kind: "weird", count: "x" })).toBe(
      "The pool changed",
    );
  });
});

describe("payload builders", () => {
  it("build the expected shapes", () => {
    expect(memberJoined(" Sam ")).toEqual({
      type: "member_joined",
      payload: { name: "Sam" },
    });
    expect(memberLeft("Sam").type).toBe("member_left");
    expect(memberRemoved("Sam").type).toBe("member_removed");
    expect(adminTransferred("A", "B").payload).toEqual({ from: "A", to: "B" });
    expect(draftDateChanged(null).payload).toEqual({ draftAt: null });
    expect(joinCodeRegenerated().payload).toEqual({});
    expect(poolChanged("imported", 12.9).payload).toEqual({
      kind: "imported",
      count: 12,
    });
    expect(poolChanged("cleared", -3).payload).toEqual({
      kind: "cleared",
      count: 0,
    });
  });

  it("truncates names and never leaves one empty", () => {
    expect(Array.from(cleanName("x".repeat(200))).length).toBe(60);
    expect(cleanName("   ")).toBe("Someone");
    expect(cleanName(null)).toBe("Someone");
  });

  it("keeps any payload under the database limit", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 500 }),
        fc.string({ maxLength: 500 }),
        (a, b) => {
          const bytes = new TextEncoder().encode(
            JSON.stringify(adminTransferred(a, b).payload),
          ).length;
          expect(bytes).toBeLessThan(MAX_PAYLOAD_BYTES);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("eventFromRow", () => {
  const row = {
    id: "e1",
    league_id: "l1",
    seq: "7",
    type: "member_joined",
    payload: { name: "Sam" },
    actor_id: null,
    created_at: "2026-01-01T00:00:00+00:00",
  };

  it("converts a row, reading a string seq", () => {
    expect(eventFromRow(row)).toMatchObject({
      seq: 7,
      leagueId: "l1",
      actorId: null,
    });
  });

  it("skips unusable rows and fixes a bad payload", () => {
    expect(eventFromRow(null)).toBeNull();
    expect(eventFromRow({ ...row, seq: "0" })).toBeNull();
    expect(eventFromRow({ ...row, seq: "abc" })).toBeNull();
    expect(eventFromRow({ ...row, payload: [1] })?.payload).toEqual({});
  });
});
