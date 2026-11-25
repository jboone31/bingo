import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAGUE_ID,
  SUBMISSION_ID,
  USER_ID,
  jsonRequest,
  league,
  mockPoolQueries,
  mockQueries,
} from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q, p } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
  p: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/leagues/queries", () => q);
vi.mock("@/lib/pool/queries", () => p);

import { DELETE, PATCH } from "./route";

const params = (leagueId = LEAGUE_ID, submissionId = SUBMISSION_ID) => ({
  params: Promise.resolve({ leagueId, submissionId }),
});
const patch = (body: unknown, id = SUBMISSION_ID) =>
  PATCH(jsonRequest("PATCH", body), params(LEAGUE_ID, id));
const del = (id = SUBMISSION_ID) =>
  DELETE(jsonRequest("DELETE"), params(LEAGUE_ID, id));

beforeEach(() => {
  Object.assign(q, mockQueries());
  Object.assign(p, mockPoolQueries());
  getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
  withTransaction
    .mockReset()
    .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  q.lockLeagueById.mockResolvedValue(league());
  q.getMemberRole.mockResolvedValue("admin");
  p.updateSubmission.mockResolvedValue(true);
});

describe("PATCH submission", () => {
  it.each([
    ["no fields", {}, "invalid_body"],
    ["unknown key", { text: "A", seq: 1 }, "invalid_body"],
    ["blank text", { text: " " }, "invalid_text"],
    ["long submitter", { submitter: "s".repeat(61) }, "invalid_submitter"],
    ["long category", { category: "c".repeat(41) }, "invalid_category"],
  ])("400 for %s", async (_label, body, reason) => {
    const res = await patch(body);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, reason });
  });

  it("400 for a bad submission id", async () => {
    expect((await patch({ text: "A" }, "nope")).status).toBe(400);
  });

  it("401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await patch({ text: "A" })).status).toBe(401);
  });

  it("updates only the fields sent, scoped to the league", async () => {
    expect(await (await patch({ category: " Pop   Culture " })).json()).toEqual(
      {
        ok: true,
      },
    );
    expect(p.updateSubmission).toHaveBeenCalledWith(
      {},
      LEAGUE_ID,
      SUBMISSION_ID,
      { category: "Pop Culture" },
    );
  });

  it("lets an empty submitter clear the field", async () => {
    await patch({ submitter: "" });
    expect(p.updateSubmission.mock.calls[0][3]).toEqual({ submitter: "" });
  });

  it("404 submission_not_found when the row is not in this league", async () => {
    p.updateSubmission.mockResolvedValue(false);
    const res = await patch({ text: "A" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      ok: false,
      reason: "submission_not_found",
    });
  });

  it("403 for members, 404 for non-members, 409 after the start", async () => {
    q.getMemberRole.mockResolvedValue("member");
    expect((await patch({ text: "A" })).status).toBe(403);
    q.getMemberRole.mockResolvedValue(null);
    expect((await patch({ text: "A" })).status).toBe(404);
    q.getMemberRole.mockResolvedValue("admin");
    q.lockLeagueById.mockResolvedValue(league({ status: "drafting" }));
    expect((await patch({ text: "A" })).status).toBe(409);
    expect(p.updateSubmission).not.toHaveBeenCalled();
  });
});

describe("DELETE submission", () => {
  it("deletes the row, scoped to the league", async () => {
    expect(await (await del()).json()).toEqual({ ok: true });
    expect(p.deleteSubmission).toHaveBeenCalledWith(
      {},
      LEAGUE_ID,
      SUBMISSION_ID,
    );
  });

  it("succeeds when the row is already gone (the query is a no-op)", async () => {
    p.deleteSubmission.mockResolvedValue(undefined);
    expect((await del()).status).toBe(200);
  });

  it("400 for a bad id, 401 signed out", async () => {
    expect((await del("nope")).status).toBe(400);
    getSessionUser.mockResolvedValue(null);
    expect((await del()).status).toBe(401);
  });

  it("403 for members and 409 after the start", async () => {
    q.getMemberRole.mockResolvedValue("member");
    expect((await del()).status).toBe(403);
    q.getMemberRole.mockResolvedValue("admin");
    q.lockLeagueById.mockResolvedValue(league({ status: "in_progress" }));
    expect((await del()).status).toBe(409);
    expect(p.deleteSubmission).not.toHaveBeenCalled();
  });
});
