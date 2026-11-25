import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAGUE_ID,
  OTHER_ID,
  SUBMISSION_ID,
  USER_ID,
  jsonRequest,
  mockQueueQueries,
} from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/queue/queries", () => q);

import { POST, PUT } from "./route";

const params = { params: Promise.resolve({ leagueId: LEAGUE_ID }) };
const add = (body: unknown) => POST(jsonRequest("POST", body), params);
const reorder = (body: unknown) => PUT(jsonRequest("PUT", body), params);

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(() => {
  Object.assign(q, mockQueueQueries());
  getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
  withTransaction
    .mockReset()
    .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  q.lockMemberForQueue.mockResolvedValue("pre_draft");
  q.submissionInLeague.mockResolvedValue(true);
  q.getQueueIds.mockResolvedValue([A, B]);
  q.insertQueueItem.mockResolvedValue(true);
});

describe("POST /api/leagues/[leagueId]/queue", () => {
  it.each([
    ["bad json", "{"],
    ["missing id", {}],
    ["not a uuid", { submissionId: "nope" }],
    ["unknown key", { submissionId: SUBMISSION_ID, position: 1 }],
  ])("400 for %s", async (_label, body) => {
    expect((await add(body)).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await add({ submissionId: SUBMISSION_ID })).status).toBe(401);
  });

  it("404 for a non-member, and nothing else runs", async () => {
    q.lockMemberForQueue.mockResolvedValue(null);
    const res = await add({ submissionId: SUBMISSION_ID });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "league_not_found" });
    expect(q.insertQueueItem).not.toHaveBeenCalled();
  });

  it("409 once the draft has started", async () => {
    q.lockMemberForQueue.mockResolvedValue("drafting");
    const res = await add({ submissionId: SUBMISSION_ID });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "league_not_pre_draft",
    });
    expect(q.insertQueueItem).not.toHaveBeenCalled();
  });

  it("404 submission_not_found for a square outside this league", async () => {
    q.submissionInLeague.mockResolvedValue(false);
    const res = await add({ submissionId: SUBMISSION_ID });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "submission_not_found",
    });
  });

  it("adds to the end of the caller's own queue and returns 201", async () => {
    const res = await add({ submissionId: SUBMISSION_ID });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, queued: true });
    expect(q.insertQueueItem).toHaveBeenCalledWith(
      {},
      LEAGUE_ID,
      USER_ID,
      SUBMISSION_ID,
    );
  });

  it("is a no-op success when already queued", async () => {
    q.getQueueIds.mockResolvedValue([SUBMISSION_ID]);
    const res = await add({ submissionId: SUBMISSION_ID });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, queued: false });
    expect(q.insertQueueItem).not.toHaveBeenCalled();
  });

  it("409 queue_full at 200", async () => {
    q.getQueueIds.mockResolvedValue(
      Array.from({ length: 200 }, (_, i) => `id-${i}`),
    );
    const res = await add({ submissionId: SUBMISSION_ID });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "queue_full" });
  });

  it("500 without leaking the database error", async () => {
    q.insertQueueItem.mockRejectedValue(new Error("password=hunter2"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await add({ submissionId: SUBMISSION_ID });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
    spy.mockRestore();
  });
});

describe("PUT /api/leagues/[leagueId]/queue", () => {
  it.each([
    ["not an array", { order: "x" }],
    ["bad id", { order: [A, "nope"] }],
    ["duplicates", { order: [A, A] }],
    ["unknown key", { order: [A, B], extra: 1 }],
    ["too long", { order: Array.from({ length: 201 }, () => A) }],
    ["missing", {}],
  ])("400 for %s", async (_label, body) => {
    expect((await reorder(body)).status).toBe(400);
    expect(q.rewriteOrder).not.toHaveBeenCalled();
  });

  it("saves a re-arrangement of the current queue", async () => {
    const res = await reorder({ order: [B, A] });
    expect(await res.json()).toEqual({ ok: true });
    expect(q.rewriteOrder).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID, [B, A]);
  });

  it("is harmless to repeat the same order", async () => {
    expect((await reorder({ order: [A, B] })).status).toBe(200);
    expect((await reorder({ order: [A, B] })).status).toBe(200);
  });

  it("409 queue_changed and writes nothing when items were added elsewhere", async () => {
    q.getQueueIds.mockResolvedValue([A, B, C]);
    const res = await reorder({ order: [B, A] });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "queue_changed" });
    expect(q.rewriteOrder).not.toHaveBeenCalled();
  });

  it("409 queue_changed when the list contains a square that is not queued", async () => {
    const res = await reorder({ order: [A, OTHER_ID] });
    expect(res.status).toBe(409);
    expect(q.rewriteOrder).not.toHaveBeenCalled();
  });

  it("accepts an empty order for an empty queue", async () => {
    q.getQueueIds.mockResolvedValue([]);
    expect((await reorder({ order: [] })).status).toBe(200);
  });

  it("404 for a non-member and 409 after the draft starts", async () => {
    q.lockMemberForQueue.mockResolvedValue(null);
    expect((await reorder({ order: [A, B] })).status).toBe(404);
    q.lockMemberForQueue.mockResolvedValue("in_progress");
    expect((await reorder({ order: [A, B] })).status).toBe(409);
    expect(q.rewriteOrder).not.toHaveBeenCalled();
  });
});
