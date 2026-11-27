import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

vi.mock("server-only", () => ({}));
import { makePick, mapEngineError } from "./engine.server";

describe("mapEngineError", () => {
  it.each([
    ["not_your_turn", 409],
    ["stale_pick", 409],
    ["square_taken", 409],
    ["draft_not_running", 409],
    ["submission_not_found", 404],
  ])("maps %s to a %i ApiError", (reason, status) => {
    expect(() => mapEngineError(new Error(reason))).toThrow(ApiError);
    try {
      mapEngineError(new Error(reason));
    } catch (error) {
      expect(error).toMatchObject({ reason, status });
    }
  });

  it("rethrows anything else unchanged", () => {
    const original = new Error("connection reset");
    expect(() => mapEngineError(original)).toThrow(original);
  });
});

describe("makePick", () => {
  it("reads the engine's answer", async () => {
    const tx = {
      query: vi
        .fn()
        .mockResolvedValue({ rows: [{ result: "already_picked" }] }),
    };
    expect(
      await makePick(tx, {
        leagueId: "L",
        userId: "U",
        submissionId: "S",
        pickNumber: 3,
      }),
    ).toEqual({ alreadyPicked: true });
    expect(tx.query.mock.calls[0][1]).toEqual(["L", "U", "S", 3]);
  });

  it("turns a raised refusal into an ApiError", async () => {
    const tx = { query: vi.fn().mockRejectedValue(new Error("not_your_turn")) };
    await expect(
      makePick(tx, {
        leagueId: "L",
        userId: "U",
        submissionId: "S",
        pickNumber: 3,
      }),
    ).rejects.toMatchObject({ reason: "not_your_turn", status: 409 });
  });
});
