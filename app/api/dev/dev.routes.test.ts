import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";

const m = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  assertDevTools: vi.fn(),
  seedScenario: vi.fn(),
  resetMine: vi.fn(),
  resetAll: vi.fn(),
  actAs: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser: m.getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction: m.withTransaction }));
vi.mock("@/lib/dev/gate", () => ({ assertDevTools: m.assertDevTools }));
vi.mock("@/lib/dev/seedScenario", () => ({ seedScenario: m.seedScenario }));
vi.mock("@/lib/dev/reset", () => ({
  resetMine: m.resetMine,
  resetAll: m.resetAll,
}));
vi.mock("@/lib/dev/actAs", () => ({ actAs: m.actAs }));

import { POST as actAsPost } from "./act-as/route";
import { POST as resetPost } from "./reset/route";
import { POST as seedPost } from "./seed/route";

const USER = "22222222-2222-4222-8222-222222222222";
const TARGET = "33333333-3333-4333-8333-333333333333";
const ctx = { params: Promise.resolve({}) };
const req = (body: unknown) =>
  new NextRequest("http://localhost/api/dev/x", {
    method: "POST",
    body: JSON.stringify(body),
  });

const routes = [
  ["seed", seedPost, { scenario: "league_empty" }],
  ["reset", resetPost, { scope: "mine" }],
  ["act-as", actAsPost, { userId: TARGET }],
] as const;

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.getSessionUser.mockResolvedValue({ id: USER, email: null });
  m.withTransaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn({}),
  );
  m.assertDevTools.mockImplementation(() => undefined);
});

describe.each(routes)("POST /api/dev/%s", (_name, post, body) => {
  it("is a 404 with no other effect when dev tools are off", async () => {
    m.assertDevTools.mockImplementation(() => {
      throw new ApiError("not_found", 404);
    });
    const res = await post(req(body), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "not_found" });
    expect(m.getSessionUser).not.toHaveBeenCalled();
    expect(m.seedScenario).not.toHaveBeenCalled();
    expect(m.resetAll).not.toHaveBeenCalled();
    expect(m.actAs).not.toHaveBeenCalled();
  });

  it("is 401 when signed out", async () => {
    m.getSessionUser.mockResolvedValue(null);
    expect((await post(req(body), ctx)).status).toBe(401);
  });

  it("is 400 for a body with unknown keys", async () => {
    expect((await post(req({ ...body, extra: 1 }), ctx)).status).toBe(400);
  });

  it("hides unexpected errors", async () => {
    m.seedScenario.mockRejectedValue(new Error("service key leaked"));
    m.withTransaction.mockRejectedValue(new Error("service key leaked"));
    m.resetAll.mockRejectedValue(new Error("service key leaked"));
    m.actAs.mockRejectedValue(new Error("service key leaked"));
    const res = await post(req(body), ctx);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("leaked");
  });
});

describe("seed", () => {
  it("rejects an unknown scenario before doing anything", async () => {
    const res = await seedPost(req({ scenario: "nope" }), ctx);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason: "invalid_scenario" });
    expect(m.seedScenario).not.toHaveBeenCalled();
  });

  it("builds the scenario for the signed-in user", async () => {
    m.seedScenario.mockResolvedValue("L1");
    const res = await seedPost(req({ scenario: "member_view" }), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, leagueId: "L1" });
    expect(m.seedScenario).toHaveBeenCalledWith(USER, "member_view");
  });
});

describe("reset", () => {
  it("rejects a bad scope", async () => {
    expect((await resetPost(req({ scope: "everything" }), ctx)).status).toBe(
      400,
    );
  });

  it("resets only the caller's seed leagues for scope mine", async () => {
    m.resetMine.mockResolvedValue(2);
    const res = await resetPost(req({ scope: "mine" }), ctx);
    expect(await res.json()).toEqual({ ok: true, leagues: 2, users: 0 });
    expect(m.resetMine).toHaveBeenCalledWith({}, USER);
    expect(m.resetAll).not.toHaveBeenCalled();
  });

  it("resets all seed data for scope all", async () => {
    m.resetAll.mockResolvedValue({ leagues: 3, users: 12 });
    const res = await resetPost(req({ scope: "all" }), ctx);
    expect(await res.json()).toEqual({ ok: true, leagues: 3, users: 12 });
  });
});

describe("act-as", () => {
  it("rejects a bad user id", async () => {
    expect((await actAsPost(req({ userId: "x" }), ctx)).status).toBe(400);
    expect(m.actAs).not.toHaveBeenCalled();
  });

  it("is 404 when the target is not a seed user", async () => {
    m.actAs.mockResolvedValue(false);
    const res = await actAsPost(req({ userId: TARGET }), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, reason: "not_found" });
  });

  it("switches for a seed user", async () => {
    m.actAs.mockResolvedValue(true);
    const res = await actAsPost(req({ userId: TARGET }), ctx);
    expect(await res.json()).toEqual({ ok: true });
    expect(m.actAs).toHaveBeenCalledWith(TARGET);
  });
});
