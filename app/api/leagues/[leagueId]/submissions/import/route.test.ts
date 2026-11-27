import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAGUE_ID,
  REQUEST_ID,
  USER_ID,
  jsonRequest,
  league,
  mockPoolQueries,
  mockEvents,
  mockQueries,
} from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q, p, ev } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
  ev: {} as Record<string, ReturnType<typeof vi.fn>>,
  p: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/leagues/queries", () => q);
vi.mock("@/lib/events/append", () => ev);
vi.mock("@/lib/pool/queries", () => p);

import { POST } from "./route";

const params = { params: Promise.resolve({ leagueId: LEAGUE_ID }) };
const send = (body: unknown) => POST(jsonRequest("POST", body), params);
const CSV = "text,submitter,category\nA,Sam,X\nA,Sam,X\nB,,\n";

beforeEach(() => {
  Object.assign(q, mockQueries());
  Object.assign(ev, mockEvents());
  Object.assign(p, mockPoolQueries());
  getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
  withTransaction
    .mockReset()
    .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  q.lockLeagueById.mockResolvedValue(league());
  q.getMemberRole.mockResolvedValue("admin");
  p.recordImport.mockResolvedValue({
    importId: "I1",
    existing: false,
    rowCount: 3,
  });
  p.countSubmissions.mockResolvedValue(0);
  p.insertSubmissions.mockResolvedValue([]);
});

describe("POST /api/leagues/[leagueId]/submissions/import", () => {
  it.each([
    ["csv is not a string", { csv: 5, requestId: REQUEST_ID }],
    ["missing request id", { csv: CSV }],
    ["unknown key", { csv: CSV, requestId: REQUEST_ID, x: 1 }],
    [
      "dryRun is not a boolean",
      { csv: CSV, requestId: REQUEST_ID, dryRun: "yes" },
    ],
  ])("400 when %s", async (_label, body) => {
    expect((await send(body)).status).toBe(400);
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("413 for a file over 1 MB, before any other work", async () => {
    const res = await send({
      csv: "a".repeat(1_000_001),
      requestId: REQUEST_ID,
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ ok: false, reason: "csv_too_large" });
    expect(withTransaction).not.toHaveBeenCalled();
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await send({ csv: CSV, requestId: REQUEST_ID })).status).toBe(401);
  });

  it("403 for a member and 409 after the draft starts, without parsing", async () => {
    q.getMemberRole.mockResolvedValue("member");
    expect((await send({ csv: CSV, requestId: REQUEST_ID })).status).toBe(403);
    q.getMemberRole.mockResolvedValue("admin");
    q.lockLeagueById.mockResolvedValue(league({ status: "drafting" }));
    expect((await send({ csv: CSV, requestId: REQUEST_ID })).status).toBe(409);
    expect(p.recordImport).not.toHaveBeenCalled();
  });

  it("dry run returns a preview and writes nothing", async () => {
    const res = await send({ csv: CSV, requestId: REQUEST_ID, dryRun: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      rowCount: 3,
      preview: [
        { text: "A", submitter: "Sam", category: "X" },
        { text: "A", submitter: "Sam", category: "X" },
        { text: "B", submitter: "", category: "" },
      ],
    });
    expect(p.recordImport).not.toHaveBeenCalled();
    expect(p.insertSubmissions).not.toHaveBeenCalled();
  });

  it("imports every row, keeping duplicates, and returns 201", async () => {
    const res = await send({ csv: CSV, requestId: REQUEST_ID });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, imported: 3 });
    expect(p.insertSubmissions.mock.calls[0][3]).toHaveLength(3);
    expect(ev.appendLeagueEvent).toHaveBeenCalledTimes(1);
    expect(ev.appendLeagueEvent).toHaveBeenCalledWith({}, LEAGUE_ID, USER_ID, {
      type: "pool_changed",
      payload: { kind: "imported", count: 3 },
    });
  });

  it("returns 422 with row errors and imports nothing for a bad file", async () => {
    const res = await send({
      csv: "text\nOk\n\n,\n",
      requestId: REQUEST_ID,
    });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "csv_invalid",
      errors: [{ row: 4, column: "text", reason: "invalid_text" }],
      totalErrors: 1,
    });
    expect(p.recordImport).not.toHaveBeenCalled();
    expect(p.insertSubmissions).not.toHaveBeenCalled();
  });

  it("422 csv_empty for a header with no rows", async () => {
    const res = await send({ csv: "text\n", requestId: REQUEST_ID });
    expect(res.status).toBe(422);
    expect((await res.json()).reason).toBe("csv_empty");
  });

  it("does not insert again for a repeated request id", async () => {
    p.recordImport.mockResolvedValue({
      importId: "I1",
      existing: true,
      rowCount: 3,
    });
    const res = await send({ csv: CSV, requestId: REQUEST_ID });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      imported: 3,
      alreadyImported: true,
    });
    expect(p.insertSubmissions).not.toHaveBeenCalled();
    expect(ev.appendLeagueEvent).not.toHaveBeenCalled();
  });

  it("409 pool_full when the file would pass the cap", async () => {
    p.countSubmissions.mockResolvedValue(4998);
    const res = await send({ csv: CSV, requestId: REQUEST_ID });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "pool_full" });
    expect(p.insertSubmissions).not.toHaveBeenCalled();
  });
});
