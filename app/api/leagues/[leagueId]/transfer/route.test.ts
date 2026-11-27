import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAGUE_ID,
  OTHER_ID,
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

const call = (body: unknown = { userId: OTHER_ID }) =>
  POST(jsonRequest("POST", body), {
    params: Promise.resolve({ leagueId: LEAGUE_ID }),
  });

describe("POST /api/leagues/[leagueId]/transfer", () => {
  beforeEach(() => {
    Object.assign(q, mockQueries());
    Object.assign(ev, mockEvents());
    getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
    withTransaction
      .mockReset()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
    q.lockLeagueById.mockResolvedValue(league());
    // Caller's role first, then the target's.
    q.getMemberRole
      .mockResolvedValueOnce("admin")
      .mockResolvedValueOnce("member");
  });

  it("400 for a bad body", async () => {
    expect((await call({ userId: "nope" })).status).toBe(400);
    expect((await call({})).status).toBe(400);
    expect((await call({ userId: OTHER_ID, x: 1 })).status).toBe(400);
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("demotes the caller, then promotes the target", async () => {
    expect(await (await call()).json()).toEqual({ ok: true });
    expect(q.setRole.mock.calls).toEqual([
      [{}, LEAGUE_ID, USER_ID, "member"],
      [{}, LEAGUE_ID, OTHER_ID, "admin"],
    ]);
  });

  it("works in any league status", async () => {
    q.lockLeagueById.mockResolvedValue(league({ status: "in_progress" }));
    expect((await call()).status).toBe(200);
  });

  it("409 when the target is not a member", async () => {
    q.getMemberRole
      .mockReset()
      .mockResolvedValueOnce("admin")
      .mockResolvedValueOnce(null);
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "target_not_member",
    });
    expect(q.setRole).not.toHaveBeenCalled();
  });

  it("403 for a regular member", async () => {
    q.getMemberRole.mockReset().mockResolvedValue("member");
    expect((await call()).status).toBe(403);
    expect(q.setRole).not.toHaveBeenCalled();
  });

  it("is a no-op when the target is already admin", async () => {
    q.getMemberRole.mockReset().mockResolvedValue("admin");
    expect(await (await call({ userId: USER_ID })).json()).toEqual({
      ok: true,
    });
    expect(q.setRole).not.toHaveBeenCalled();
  });

  it("appends admin_transferred with both names", async () => {
    ev.displayNameOf.mockResolvedValueOnce("Alex").mockResolvedValueOnce("Sam");
    await call();
    expect(ev.appendLeagueEvent).toHaveBeenCalledTimes(1);
    expect(ev.appendLeagueEvent).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID, {
      type: "admin_transferred",
      payload: { from: "Alex", to: "Sam" },
    });
  });
  it("appends nothing when the target is already admin or the call is refused", async () => {
    q.getMemberRole
      .mockReset()
      .mockResolvedValueOnce("admin")
      .mockResolvedValueOnce("admin");
    await call();
    q.getMemberRole.mockReset().mockResolvedValue("member");
    await call();
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });
});
