import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import {
  LEAGUE_ID,
  SUBMISSION_ID,
  USER_ID,
  jsonRequest,
  league,
  mockQueries,
} from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q, e } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
  e: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/leagues/queries", () => q);
vi.mock("@/lib/draft/engine.server", () => e);

import { POST as pickPost } from "./pick/route";
import { POST as settlePost } from "./settle/route";

const params = (id = LEAGUE_ID) => ({
  params: Promise.resolve({ leagueId: id }),
});
const pick = (body: unknown, id?: string) =>
  pickPost(jsonRequest("POST", body), params(id));
const settle = (body: unknown = {}, id?: string) =>
  settlePost(jsonRequest("POST", body), params(id));
const good = { submissionId: SUBMISSION_ID, pickNumber: 4 };

beforeEach(() => {
  Object.assign(q, mockQueries());
  Object.assign(e, {
    makePick: vi.fn().mockResolvedValue({ alreadyPicked: false }),
    settleLeague: vi.fn().mockResolvedValue(2),
    databaseNow: vi.fn().mockResolvedValue(1_700_000_000_000),
  });
  getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
  withTransaction
    .mockReset()
    .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  q.lockLeagueById.mockResolvedValue(league({ status: "drafting" }));
  q.getMemberRole.mockResolvedValue("member");
});

describe("POST .../draft/pick", () => {
  it.each([
    ["no body", {}],
    ["an unknown key", { ...good, x: 1 }],
    ["a bad square id", { ...good, submissionId: "nope" }],
    ["pick 0", { ...good, pickNumber: 0 }],
    ["a fractional pick", { ...good, pickNumber: 1.5 }],
    ["a string pick", { ...good, pickNumber: "4" }],
  ])("400 for %s", async (_label, body) => {
    expect((await pick(body)).status).toBe(400);
    expect(e.makePick).not.toHaveBeenCalled();
  });

  it("401 signed out, 404 for a non-member", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await pick(good)).status).toBe(401);
    getSessionUser.mockResolvedValue({ id: USER_ID, email: null });
    q.getMemberRole.mockResolvedValue(null);
    expect((await pick(good)).status).toBe(404);
    expect(e.makePick).not.toHaveBeenCalled();
  });

  it("picks for the caller", async () => {
    const res = await pick(good);
    expect(await res.json()).toEqual({ ok: true, pickNumber: 4 });
    expect(e.makePick).toHaveBeenCalledWith(
      {},
      {
        leagueId: LEAGUE_ID,
        userId: USER_ID,
        submissionId: SUBMISSION_ID,
        pickNumber: 4,
      },
    );
  });

  it("reports a repeat", async () => {
    e.makePick.mockResolvedValue({ alreadyPicked: true });
    expect(await (await pick(good)).json()).toEqual({
      ok: true,
      pickNumber: 4,
      alreadyPicked: true,
    });
  });

  it.each(["not_your_turn", "stale_pick", "square_taken", "draft_not_running"])(
    "passes the %s refusal through as 409",
    async (reason) => {
      e.makePick.mockRejectedValue(new ApiError(reason, 409));
      const res = await pick(good);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ ok: false, reason });
    },
  );

  it("hides unexpected errors", async () => {
    e.makePick.mockRejectedValue(new Error("deadlock detected"));
    const res = await pick(good);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("deadlock");
  });
});

describe("POST .../draft/settle", () => {
  it("settles and returns the database clock", async () => {
    const res = await settle();
    expect(await res.json()).toEqual({
      ok: true,
      now: 1_700_000_000_000,
      picks: 2,
    });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(e.settleLeague).toHaveBeenCalledWith({}, LEAGUE_ID);
  });

  it("refuses unknown keys, non-members and signed-out callers", async () => {
    expect((await settle({ x: 1 })).status).toBe(400);
    q.getMemberRole.mockResolvedValue(null);
    expect((await settle()).status).toBe(404);
    getSessionUser.mockResolvedValue(null);
    expect((await settle()).status).toBe(401);
    expect(e.settleLeague).not.toHaveBeenCalled();
  });
});
