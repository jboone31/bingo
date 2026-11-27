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

const call = (id = LEAGUE_ID) =>
  POST(jsonRequest("POST"), { params: Promise.resolve({ leagueId: id }) });

describe("POST /api/leagues/[leagueId]/leave", () => {
  beforeEach(() => {
    Object.assign(q, mockQueries());
    Object.assign(ev, mockEvents());
    getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
    withTransaction
      .mockReset()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
    q.lockLeagueById.mockResolvedValue(league());
    q.getMemberRole.mockResolvedValue("member");
  });

  it("400 for a bad league id", async () => {
    expect((await call("nope")).status).toBe(400);
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("removes the caller's membership", async () => {
    const res = await call();
    expect(await res.json()).toEqual({ ok: true });
    expect(q.deleteMember).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID);
  });

  it("succeeds without change when not a member or the league is missing", async () => {
    q.getMemberRole.mockResolvedValue(null);
    expect(await (await call()).json()).toEqual({ ok: true });
    q.lockLeagueById.mockResolvedValue(null);
    expect(await (await call()).json()).toEqual({ ok: true });
    expect(q.deleteMember).not.toHaveBeenCalled();
  });

  it("409 for the admin", async () => {
    q.getMemberRole.mockResolvedValue("admin");
    const res = await call();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "admin_cannot_leave",
    });
  });

  it("409 after the draft starts", async () => {
    q.lockLeagueById.mockResolvedValue(league({ status: "drafting" }));
    const res = await call();
    expect(res.status).toBe(409);
    expect(q.deleteMember).not.toHaveBeenCalled();
  });

  it("appends member_left when a row was removed", async () => {
    await call();
    expect(ev.appendLeagueEvent).toHaveBeenCalledTimes(1);
    expect(ev.appendLeagueEvent).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID, {
      type: "member_left",
      payload: { name: "Sam" },
    });
  });
  it("appends nothing when no row was removed, or the caller is not a member", async () => {
    q.deleteMember.mockResolvedValue(false);
    await call();
    q.getMemberRole.mockResolvedValue(null);
    await call();
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });
  it("appends nothing when leaving is refused", async () => {
    q.getMemberRole.mockResolvedValue("admin");
    await call();
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });
});
