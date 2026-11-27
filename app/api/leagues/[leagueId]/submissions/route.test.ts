import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAGUE_ID,
  REQUEST_ID,
  USER_ID,
  jsonRequest,
  league,
  mockPoolQueries,
  mockEvents,
  mockQueries,
} from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q, p, ev } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
  ev: {} as Record<string, ReturnType<typeof vi.fn>>,
  p: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/leagues/queries", () => q);
vi.mock("@/lib/events/append", () => ev);
vi.mock("@/lib/pool/queries", () => p);

import { DELETE, POST } from "./route";

const params = { params: Promise.resolve({ leagueId: LEAGUE_ID }) };
const add = (body: unknown) => POST(jsonRequest("POST", body), params);
const good = {
  text: " Team X wins ",
  submitter: "Sam",
  category: "Sports",
  requestId: REQUEST_ID,
};

beforeEach(() => {
  Object.assign(q, mockQueries());
  Object.assign(ev, mockEvents());
  Object.assign(p, mockPoolQueries());
  getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
  withTransaction
    .mockReset()
    .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  q.lockLeagueById.mockResolvedValue(league());
  q.getMemberRole.mockResolvedValue("admin");
  p.recordImport.mockResolvedValue({
    importId: "I1",
    existing: false,
    rowCount: 1,
  });
  p.countSubmissions.mockResolvedValue(10);
  p.insertSubmissions.mockResolvedValue(["S1"]);
});

describe("POST /api/leagues/[leagueId]/submissions", () => {
  it.each([
    ["bad json", "{", "invalid_body"],
    ["unknown key", { ...good, extra: 1 }, "invalid_body"],
    ["missing request id", { text: "A" }, "invalid_body"],
    ["blank text", { ...good, text: " " }, "invalid_text"],
    [
      "long submitter",
      { ...good, submitter: "s".repeat(61) },
      "invalid_submitter",
    ],
    [
      "long category",
      { ...good, category: "c".repeat(41) },
      "invalid_category",
    ],
  ])("400 for %s", async (_label, body, reason) => {
    const res = await add(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await add(good)).status).toBe(401);
  });

  it("adds a trimmed row and returns 201", async () => {
    const res = await add(good);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, submission: { id: "S1" } });
    expect(p.insertSubmissions).toHaveBeenCalledWith({}, LEAGUE_ID, "I1", [
      { text: "Team X wins", submitter: "Sam", category: "Sports" },
    ]);
  });

  it("appends pool_changed added for a new row", async () => {
    await add(good);
    expect(ev.appendLeagueEvent).toHaveBeenCalledTimes(1);
    expect(ev.appendLeagueEvent).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID, {
      type: "pool_changed",
      payload: { kind: "added", count: 1 },
    });
  });

  it("allows an empty submitter and category", async () => {
    const res = await add({ text: "A", requestId: REQUEST_ID });
    expect(res.status).toBe(201);
    expect(p.insertSubmissions.mock.calls[0][3]).toEqual([
      { text: "A", submitter: "", category: "" },
    ]);
  });

  it("does not add again for a repeated request id", async () => {
    p.recordImport.mockResolvedValue({
      importId: "I1",
      existing: true,
      rowCount: 1,
    });
    p.firstSubmissionOfImport.mockResolvedValue("S1");
    const res = await add(good);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      submission: { id: "S1" },
      alreadyAdded: true,
    });
    expect(p.insertSubmissions).not.toHaveBeenCalled();
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });

  it("403 for a member, 404 for a non-member, 409 after the draft starts", async () => {
    q.getMemberRole.mockResolvedValue("member");
    expect((await add(good)).status).toBe(403);
    q.getMemberRole.mockResolvedValue(null);
    expect((await add(good)).status).toBe(404);
    q.getMemberRole.mockResolvedValue("admin");
    q.lockLeagueById.mockResolvedValue(league({ status: "drafting" }));
    expect((await add(good)).status).toBe(409);
    expect(p.insertSubmissions).not.toHaveBeenCalled();
  });

  it("409 pool_full at the cap", async () => {
    p.countSubmissions.mockResolvedValue(5000);
    const res = await add(good);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "pool_full" });
  });

  it("500 without leaking the database error", async () => {
    p.insertSubmissions.mockRejectedValue(new Error("password=hunter2"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await add(good);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
    spy.mockRestore();
  });
});

describe("DELETE /api/leagues/[leagueId]/submissions", () => {
  const clear = (body: unknown) => DELETE(jsonRequest("DELETE", body), params);

  it("400 unless the body is exactly { all: true }", async () => {
    expect((await clear({})).status).toBe(400);
    expect((await clear({ all: false })).status).toBe(400);
    expect((await clear({ all: true, x: 1 })).status).toBe(400);
  });

  it("clears the pool for the admin and reports the count", async () => {
    p.deleteAllSubmissions.mockResolvedValue(7);
    expect(await (await clear({ all: true })).json()).toEqual({
      ok: true,
      deleted: 7,
    });
    expect(ev.appendLeagueEvent).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID, {
      type: "pool_changed",
      payload: { kind: "cleared", count: 7 },
    });
  });

  it("succeeds on an empty pool", async () => {
    p.deleteAllSubmissions.mockResolvedValue(0);
    expect((await clear({ all: true })).status).toBe(200);
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });

  it("refuses members and started drafts", async () => {
    q.getMemberRole.mockResolvedValue("member");
    expect((await clear({ all: true })).status).toBe(403);
    q.getMemberRole.mockResolvedValue("admin");
    q.lockLeagueById.mockResolvedValue(league({ status: "in_progress" }));
    expect((await clear({ all: true })).status).toBe(409);
    expect(p.deleteAllSubmissions).not.toHaveBeenCalled();
  });
});
