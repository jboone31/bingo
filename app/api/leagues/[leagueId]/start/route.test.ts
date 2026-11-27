import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAGUE_ID,
  USER_ID,
  jsonRequest,
  league,
  mockEvents,
  mockPoolQueries,
  mockQueries,
} from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q, ev, d, p } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
  ev: {} as Record<string, ReturnType<typeof vi.fn>>,
  d: {} as Record<string, ReturnType<typeof vi.fn>>,
  p: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/leagues/queries", () => q);
vi.mock("@/lib/events/append", () => ev);
vi.mock("@/lib/draft/queries", () => d);
vi.mock("@/lib/pool/queries", () => p);
vi.mock("@/lib/draft/engine.server", () => ({
  createClocks: vi.fn(async () => {
    order.push("createClocks");
  }),
}));

import { POST } from "./route";

const MEMBERS = Array.from({ length: 15 }, (_, i) => `user-${i}`);
const good = { expected: { members: 15, groupCount: 3 } };
const start = (body: unknown = good, id = LEAGUE_ID) =>
  POST(jsonRequest("POST", body), {
    params: Promise.resolve({ leagueId: id }),
  });
const order: string[] = [];
const track = (name: string, value?: unknown) => async () => {
  order.push(name);
  return value;
};

beforeEach(() => {
  order.length = 0;
  Object.assign(q, mockQueries());
  Object.assign(ev, mockEvents());
  Object.assign(p, mockPoolQueries());
  Object.assign(d, {
    listMemberIds: vi.fn().mockResolvedValue(MEMBERS),
    markStarted: vi.fn(track("markStarted", "2026-03-01T19:00:00.000Z")),
    insertGroups: vi.fn(track("insertGroups")),
  });
  ev.appendLeagueEvent.mockImplementation(track("event", 1));
  getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
  withTransaction
    .mockReset()
    .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  q.lockLeagueById.mockImplementation(track("lock", league({ groupCount: 3 })));
  q.getMemberRole.mockResolvedValue("admin");
  p.countSubmissions.mockResolvedValue(125);
});

describe("POST /api/leagues/[leagueId]/start", () => {
  it.each([
    ["no body keys", {}],
    ["an unknown key", { ...good, x: 1 }],
    ["expected not an object", { expected: 3 }],
    [
      "an extra expected key",
      { expected: { members: 15, groupCount: 3, x: 1 } },
    ],
    ["a missing count", { expected: { members: 15 } }],
    ["zero members", { expected: { members: 0, groupCount: 1 } }],
    ["eleven groups", { expected: { members: 15, groupCount: 11 } }],
    ["a string count", { expected: { members: "15", groupCount: 3 } }],
  ])("400 for %s", async (_label, body) => {
    const res = await start(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "invalid_body" });
  });

  it("400 for a bad league id, 401 signed out", async () => {
    expect((await start(good, "nope")).status).toBe(400);
    getSessionUser.mockResolvedValue(null);
    expect((await start()).status).toBe(401);
  });

  it("locks, starts, writes balanced groups, then appends the event", async () => {
    const res = await start();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(order).toEqual([
      "lock",
      "markStarted",
      "insertGroups",
      "createClocks",
      "event",
    ]);
    const plan = d.insertGroups.mock.calls[0][2] as {
      number: number;
      members: { userId: string; position: number }[];
    }[];
    expect(plan.map((g) => g.members.length)).toEqual([5, 5, 5]);
    expect(plan.flatMap((g) => g.members.map((m) => m.userId)).sort()).toEqual(
      [...MEMBERS].sort(),
    );
    expect(ev.appendLeagueEvent).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID, {
      type: "draft_started",
      payload: { groupCount: 3, sizes: [5, 5, 5] },
    });
  });

  it("returns alreadyStarted for a repeat and writes nothing", async () => {
    q.lockLeagueById.mockResolvedValue(
      league({ status: "drafting", groupCount: 3 }),
    );
    const res = await start();
    expect(await res.json()).toEqual({ ok: true, alreadyStarted: true });
    expect(d.markStarted).not.toHaveBeenCalled();
    expect(d.insertGroups).not.toHaveBeenCalled();
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a member",
      () => q.getMemberRole.mockResolvedValue("member"),
      403,
      "not_admin",
    ],
    [
      "changed player count",
      () => d.listMemberIds.mockResolvedValue(MEMBERS.slice(1)),
      409,
      "draft_setup_changed",
    ],
    [
      "changed group count",
      () => q.lockLeagueById.mockResolvedValue(league({ groupCount: 2 })),
      409,
      "draft_setup_changed",
    ],
    [
      "a small pool",
      () => p.countSubmissions.mockResolvedValue(124),
      409,
      "pool_too_small",
    ],
  ])(
    "refuses %s and writes nothing",
    async (_label, arrange, status, reason) => {
      arrange();
      const res = await start();
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ ok: false, reason });
      expect(d.markStarted).not.toHaveBeenCalled();
      expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
    },
  );

  it("refuses too few players for the groups", async () => {
    d.listMemberIds.mockResolvedValue(MEMBERS.slice(0, 2));
    q.lockLeagueById.mockResolvedValue(league({ groupCount: 3 }));
    const res = await start({ expected: { members: 2, groupCount: 3 } });
    expect(await res.json()).toEqual({ ok: false, reason: "too_few_players" });
  });

  it("404 for a non-member or a missing league", async () => {
    q.getMemberRole.mockResolvedValue(null);
    expect((await start()).status).toBe(404);
    q.lockLeagueById.mockResolvedValue(null);
    expect((await start()).status).toBe(404);
  });
});
