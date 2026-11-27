import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAGUE_ID,
  USER_ID,
  jsonRequest,
  league,
  mockEvents,
  mockQueries,
} from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q, ev, d } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
  ev: {} as Record<string, ReturnType<typeof vi.fn>>,
  d: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/leagues/queries", () => q);
vi.mock("@/lib/events/append", () => ev);
vi.mock("@/lib/draft/queries", () => d);

import { PATCH } from "./route";

const patch = (body: unknown, id = LEAGUE_ID) =>
  PATCH(jsonRequest("PATCH", body), {
    params: Promise.resolve({ leagueId: id }),
  });

beforeEach(() => {
  Object.assign(q, mockQueries());
  Object.assign(ev, mockEvents());
  Object.assign(d, { setDraftSettings: vi.fn().mockResolvedValue(true) });
  getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
  withTransaction
    .mockReset()
    .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  q.lockLeagueById.mockResolvedValue(league());
  q.getMemberRole.mockResolvedValue("admin");
});

describe("PATCH /api/leagues/[leagueId]/draft-settings", () => {
  it.each([
    ["no keys", {}, "invalid_body"],
    ["an unknown key", { groupCount: 2, x: 1 }, "invalid_body"],
    ["groups 0", { groupCount: 0 }, "invalid_group_count"],
    ["groups 11", { groupCount: 11 }, "invalid_group_count"],
    ["groups as a string", { groupCount: "3" }, "invalid_group_count"],
    ["timer 9", { pickSeconds: 9 }, "invalid_pick_seconds"],
    ["timer 901", { pickSeconds: 901 }, "invalid_pick_seconds"],
    ["a fractional timer", { pickSeconds: 30.5 }, "invalid_pick_seconds"],
  ])("400 for %s", async (_label, body, reason) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason });
    expect(d.setDraftSettings).not.toHaveBeenCalled();
  });

  it("400 for a bad league id, 401 signed out", async () => {
    expect((await patch({ groupCount: 2 }, "nope")).status).toBe(400);
    getSessionUser.mockResolvedValue(null);
    expect((await patch({ groupCount: 2 })).status).toBe(401);
  });

  it("saves only the values sent and returns both current values", async () => {
    const res = await patch({ groupCount: 3 });
    expect(await res.json()).toEqual({
      ok: true,
      groupCount: 3,
      pickSeconds: 60,
    });
    expect(d.setDraftSettings).toHaveBeenCalledWith({}, LEAGUE_ID, {
      groupCount: 3,
      pickSeconds: undefined,
    });
  });

  it("accepts the range ends", async () => {
    expect((await patch({ groupCount: 10, pickSeconds: 900 })).status).toBe(
      200,
    );
    expect((await patch({ groupCount: 1, pickSeconds: 10 })).status).toBe(200);
  });

  it("appends draft_settings_changed only when something changed", async () => {
    await patch({ pickSeconds: 90 });
    expect(ev.appendLeagueEvent).toHaveBeenCalledTimes(1);
    expect(ev.appendLeagueEvent).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID, {
      type: "draft_settings_changed",
      payload: { groupCount: 1, pickSeconds: 90 },
    });
    ev.appendLeagueEvent.mockClear();
    d.setDraftSettings.mockResolvedValue(false);
    expect((await patch({ pickSeconds: 90 })).status).toBe(200);
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });

  it("403 for a member, 404 for a non-member, 409 after the start", async () => {
    q.getMemberRole.mockResolvedValue("member");
    expect((await patch({ groupCount: 2 })).status).toBe(403);
    q.getMemberRole.mockResolvedValue(null);
    expect((await patch({ groupCount: 2 })).status).toBe(404);
    q.getMemberRole.mockResolvedValue("admin");
    q.lockLeagueById.mockResolvedValue(league({ status: "drafting" }));
    const res = await patch({ groupCount: 2 });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "league_not_pre_draft",
    });
    expect(d.setDraftSettings).not.toHaveBeenCalled();
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });
});
