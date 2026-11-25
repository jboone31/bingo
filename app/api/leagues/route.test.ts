import { beforeEach, describe, expect, it, vi } from "vitest";
import { USER_ID, jsonRequest, mockQueries } from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/leagues/queries", () => q);

import { POST } from "./route";

const call = (body: unknown) =>
  POST(jsonRequest("POST", body), { params: Promise.resolve({}) });
const good = {
  name: " Office 2026 ",
  draftAt: "2026-03-01T19:00:00Z",
  requestId: "44444444-4444-4444-8444-444444444444",
};

describe("POST /api/leagues", () => {
  beforeEach(() => {
    Object.assign(q, mockQueries());
    getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
    withTransaction
      .mockReset()
      .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  });

  it.each([
    ["bad json", "{", "invalid_body"],
    ["unknown key", { ...good, role: "admin" }, "invalid_body"],
    ["missing requestId", { name: "A" }, "invalid_body"],
    ["blank name", { ...good, name: "  " }, "invalid_name"],
    ["bad date", { ...good, draftAt: "soon" }, "invalid_draft_at"],
  ])("400 for %s", async (_label, body, reason) => {
    const res = await call(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await call(good)).status).toBe(401);
    expect(q.createLeague).not.toHaveBeenCalled();
  });

  it("creates with normalized input and returns 201", async () => {
    q.createLeague.mockResolvedValue({ id: "L1", created: true });
    const res = await call(good);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, league: { id: "L1" } });
    expect(q.createLeague).toHaveBeenCalledWith(
      {},
      {
        name: "Office 2026",
        draftAt: "2026-03-01T19:00:00.000Z",
        requestId: good.requestId,
        userId: USER_ID,
      },
    );
  });

  it("accepts a missing draft date", async () => {
    q.createLeague.mockResolvedValue({ id: "L1", created: true });
    const res = await call({ name: "A", requestId: good.requestId });
    expect(res.status).toBe(201);
    expect(q.createLeague.mock.calls[0][1].draftAt).toBeNull();
  });

  it("returns 200 with the same league on a repeated request", async () => {
    q.createLeague.mockResolvedValue({ id: "L1", created: false });
    const res = await call(good);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, league: { id: "L1" } });
  });

  it("500 without leaking the database error", async () => {
    withTransaction.mockRejectedValue(new Error("password=hunter2"));
    const res = await call(good);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
  });
});
