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

import { DELETE, PATCH } from "./route";

const call = (body: unknown = { confirmName: "Office 2026" }) =>
  DELETE(jsonRequest("DELETE", body), {
    params: Promise.resolve({ leagueId: LEAGUE_ID }),
  });

describe("DELETE /api/leagues/[leagueId]", () => {
  beforeEach(() => {
    Object.assign(q, mockQueries());
    getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
    withTransaction
      .mockReset()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
    q.lockLeagueById.mockResolvedValue(league());
    q.getMemberRole.mockResolvedValue("admin");
  });

  it("400 for a bad body", async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ confirmName: 5 })).status).toBe(400);
    expect((await call("{")).status).toBe(400);
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("deletes when the admin types the exact name", async () => {
    expect(await (await call()).json()).toEqual({ ok: true });
    expect(q.deleteLeague).toHaveBeenCalledWith({}, LEAGUE_ID);
  });

  it("400 confirmation_mismatch for a different name", async () => {
    const res = await call({ confirmName: "Office" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "confirmation_mismatch",
    });
    expect(q.deleteLeague).not.toHaveBeenCalled();
  });

  it("403 for a regular member and 404 for a non-member or missing league", async () => {
    q.getMemberRole.mockResolvedValue("member");
    expect((await call()).status).toBe(403);
    q.getMemberRole.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    q.lockLeagueById.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(q.deleteLeague).not.toHaveBeenCalled();
  });

  it("409 after the draft starts", async () => {
    q.lockLeagueById.mockResolvedValue(league({ status: "drafting" }));
    expect((await call()).status).toBe(409);
    expect(q.deleteLeague).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/leagues/[leagueId]", () => {
  const patch = (body: unknown) =>
    PATCH(jsonRequest("PATCH", body), {
      params: Promise.resolve({ leagueId: LEAGUE_ID }),
    });

  beforeEach(() => {
    Object.assign(q, mockQueries(), { setDraftAt: vi.fn() });
    getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
    withTransaction
      .mockReset()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
    q.lockLeagueById.mockResolvedValue(league());
    q.getMemberRole.mockResolvedValue("admin");
  });

  it.each([
    ["missing key", {}],
    ["unknown key", { draftAt: null, name: "x" }],
    ["bad type", { draftAt: 5 }],
    ["blank", { draftAt: "" }],
    ["not a date", { draftAt: "soon" }],
  ])("400 for %s", async (_label, body) => {
    expect((await patch(body)).status).toBe(400);
    expect(q.setDraftAt).not.toHaveBeenCalled();
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await patch({ draftAt: null })).status).toBe(401);
  });

  it("sets a normalized date", async () => {
    const res = await patch({ draftAt: "2026-03-01T13:00:00-06:00" });
    expect(await res.json()).toEqual({
      ok: true,
      draftAt: "2026-03-01T19:00:00.000Z",
    });
    expect(q.setDraftAt).toHaveBeenCalledWith(
      {},
      LEAGUE_ID,
      "2026-03-01T19:00:00.000Z",
    );
  });

  it("clears the date with null", async () => {
    expect(await (await patch({ draftAt: null })).json()).toEqual({
      ok: true,
      draftAt: null,
    });
    expect(q.setDraftAt).toHaveBeenCalledWith({}, LEAGUE_ID, null);
  });

  it("403 for a regular member, 404 for a non-member", async () => {
    q.getMemberRole.mockResolvedValue("member");
    expect((await patch({ draftAt: null })).status).toBe(403);
    q.getMemberRole.mockResolvedValue(null);
    expect((await patch({ draftAt: null })).status).toBe(404);
    expect(q.setDraftAt).not.toHaveBeenCalled();
  });

  it("409 after the draft starts", async () => {
    q.lockLeagueById.mockResolvedValue(league({ status: "drafting" }));
    expect((await patch({ draftAt: null })).status).toBe(409);
    expect(q.setDraftAt).not.toHaveBeenCalled();
  });
});
