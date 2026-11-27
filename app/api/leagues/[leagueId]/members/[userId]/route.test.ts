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

import { DELETE } from "./route";

const call = (target = OTHER_ID, id = LEAGUE_ID) =>
  DELETE(jsonRequest("DELETE"), {
    params: Promise.resolve({ leagueId: id, userId: target }),
  });

describe("DELETE /api/leagues/[leagueId]/members/[userId]", () => {
  beforeEach(() => {
    Object.assign(q, mockQueries());
    Object.assign(ev, mockEvents());
    getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
    withTransaction
      .mockReset()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
    q.lockLeagueById.mockResolvedValue(league());
    // First call: the caller's role. Second call: the target's role.
    q.getMemberRole
      .mockResolvedValueOnce("admin")
      .mockResolvedValueOnce("member");
  });

  it("400 for bad ids", async () => {
    expect((await call("nope")).status).toBe(400);
    expect((await call(OTHER_ID, "nope")).status).toBe(400);
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("404 for a non-member caller", async () => {
    q.getMemberRole.mockReset().mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "league_not_found" });
  });

  it("403 for a regular member", async () => {
    q.getMemberRole.mockReset().mockResolvedValue("member");
    const res = await call();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, reason: "not_admin" });
    expect(q.deleteMember).not.toHaveBeenCalled();
  });

  it("409 when the admin targets themselves", async () => {
    const res = await call(USER_ID);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "cannot_remove_self",
    });
  });

  it("409 after the draft starts", async () => {
    q.lockLeagueById.mockResolvedValue(league({ status: "drafting" }));
    expect((await call()).status).toBe(409);
    expect(q.deleteMember).not.toHaveBeenCalled();
  });

  it("removes the member", async () => {
    expect(await (await call()).json()).toEqual({ ok: true });
    expect(q.deleteMember).toHaveBeenCalledWith({}, LEAGUE_ID, OTHER_ID);
  });

  it("succeeds without change when the target is not a member", async () => {
    q.getMemberRole
      .mockReset()
      .mockResolvedValueOnce("admin")
      .mockResolvedValueOnce(null);
    expect(await (await call()).json()).toEqual({ ok: true });
    expect(q.deleteMember).not.toHaveBeenCalled();
  });

  it("appends member_removed by the admin", async () => {
    await call();
    expect(ev.appendLeagueEvent).toHaveBeenCalledTimes(1);
    expect(ev.appendLeagueEvent).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID, {
      type: "member_removed",
      payload: { name: "Sam" },
    });
    expect(ev.displayNameOf).toHaveBeenCalledWith({}, OTHER_ID);
  });
  it("appends nothing when no row was removed", async () => {
    q.deleteMember.mockResolvedValue(false);
    await call();
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });
  it("appends nothing when the target is not a member or the call is refused", async () => {
    q.getMemberRole
      .mockReset()
      .mockResolvedValueOnce("admin")
      .mockResolvedValueOnce(null);
    await call();
    q.getMemberRole.mockReset().mockResolvedValue("member");
    await call();
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });
});
