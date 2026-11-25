import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAGUE_ID,
  USER_ID,
  jsonRequest,
  league,
  mockQueries,
} from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/leagues/queries", () => q);

import { POST } from "./route";

const call = (id = LEAGUE_ID) =>
  POST(jsonRequest("POST"), { params: Promise.resolve({ leagueId: id }) });

describe("POST /api/leagues/[leagueId]/leave", () => {
  beforeEach(() => {
    Object.assign(q, mockQueries());
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
});
