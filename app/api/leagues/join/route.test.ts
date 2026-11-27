import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAGUE_ID,
  USER_ID,
  jsonRequest,
  league,
  mockEvents,
  mockQueries,
} from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q, ev } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
  ev: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/leagues/queries", () => q);
vi.mock("@/lib/events/append", () => ev);

import { POST } from "./route";

const call = (body: unknown) =>
  POST(jsonRequest("POST", body), { params: Promise.resolve({}) });

describe("POST /api/leagues/join", () => {
  beforeEach(() => {
    Object.assign(q, mockQueries());
    Object.assign(ev, mockEvents());
    getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
    withTransaction
      .mockReset()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
    q.lockLeagueByCode.mockResolvedValue(league());
    q.getMemberRole.mockResolvedValue(null);
    q.countMembers.mockResolvedValue(5);
  });

  it("400 invalid_code for a code that cannot be valid", async () => {
    const res = await call({ code: "K7P2QX0M" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "invalid_code" });
  });

  it("400 invalid_body for unknown keys", async () => {
    expect((await call({ code: "K7P2QX9M", x: 1 })).status).toBe(400);
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await call({ code: "K7P2QX9M" })).status).toBe(401);
  });

  it("404 for an unknown code", async () => {
    q.lockLeagueByCode.mockResolvedValue(null);
    const res = await call({ code: "K7P2QX9M" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "league_not_found" });
  });

  it("joins with a normalized code as a regular member", async () => {
    const res = await call({ code: " k7p2-qx9m " });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      leagueId: LEAGUE_ID,
      alreadyMember: false,
    });
    expect(q.lockLeagueByCode).toHaveBeenCalledWith({}, "K7P2QX9M");
    expect(q.insertMember).toHaveBeenCalledWith(
      {},
      LEAGUE_ID,
      USER_ID,
      "member",
    );
  });

  it("is a no-op when already a member", async () => {
    q.getMemberRole.mockResolvedValue("member");
    const res = await call({ code: "K7P2QX9M" });
    expect(await res.json()).toMatchObject({ ok: true, alreadyMember: true });
    expect(q.insertMember).not.toHaveBeenCalled();
  });

  it("409 once the draft has started", async () => {
    q.lockLeagueByCode.mockResolvedValue(league({ status: "drafting" }));
    const res = await call({ code: "K7P2QX9M" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "league_not_pre_draft",
    });
    expect(q.insertMember).not.toHaveBeenCalled();
  });

  it("409 when the league is full", async () => {
    q.countMembers.mockResolvedValue(100);
    const res = await call({ code: "K7P2QX9M" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "league_full" });
  });

  it("500 without leaking the database error", async () => {
    q.insertMember.mockRejectedValue(new Error("password=hunter2"));
    const res = await call({ code: "K7P2QX9M" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
  });

  it("appends member_joined for a new member", async () => {
    await call({ code: "K7P2QX9M" });
    expect(ev.appendLeagueEvent).toHaveBeenCalledTimes(1);
    expect(ev.appendLeagueEvent).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID, {
      type: "member_joined",
      payload: { name: "Sam" },
    });
  });
  it("appends nothing when the caller is already a member", async () => {
    q.getMemberRole.mockResolvedValue("member");
    await call({ code: "K7P2QX9M" });
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });
  it("appends nothing when the join is refused", async () => {
    q.lockLeagueByCode.mockResolvedValue(league({ status: "drafting" }));
    await call({ code: "K7P2QX9M" });
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });
});
