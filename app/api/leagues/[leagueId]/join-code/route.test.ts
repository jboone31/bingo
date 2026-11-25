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

describe("POST /api/leagues/[leagueId]/join-code", () => {
  beforeEach(() => {
    Object.assign(q, mockQueries());
    getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
    withTransaction
      .mockReset()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
    q.lockLeagueById.mockResolvedValue(league());
    q.getMemberRole.mockResolvedValue("admin");
    q.setJoinCode.mockResolvedValue("NEWCODE2");
  });

  it("400 for a bad id and 401 when signed out", async () => {
    expect((await call("nope")).status).toBe(400);
    getSessionUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("returns the new code for the admin", async () => {
    expect(await (await call()).json()).toEqual({
      ok: true,
      joinCode: "NEWCODE2",
    });
    expect(q.setJoinCode).toHaveBeenCalledWith({}, LEAGUE_ID);
  });

  it("403 for a regular member and 404 for a non-member", async () => {
    q.getMemberRole.mockResolvedValue("member");
    expect((await call()).status).toBe(403);
    q.getMemberRole.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(q.setJoinCode).not.toHaveBeenCalled();
  });

  it("409 after the draft starts", async () => {
    q.lockLeagueById.mockResolvedValue(league({ status: "in_progress" }));
    expect((await call()).status).toBe(409);
  });
});
