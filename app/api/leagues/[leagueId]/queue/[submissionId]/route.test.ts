import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LEAGUE_ID,
  SUBMISSION_ID,
  USER_ID,
  jsonRequest,
  mockQueueQueries,
} from "@/test/helpers/leagueRoutes";

const { getSessionUser, withTransaction, q } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  withTransaction: vi.fn(),
  q: {} as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));
vi.mock("@/lib/db/server", () => ({ withTransaction }));
vi.mock("@/lib/queue/queries", () => q);

import { DELETE } from "./route";

const call = (leagueId = LEAGUE_ID, submissionId = SUBMISSION_ID) =>
  DELETE(jsonRequest("DELETE"), {
    params: Promise.resolve({ leagueId, submissionId }),
  });

beforeEach(() => {
  Object.assign(q, mockQueueQueries());
  getSessionUser.mockReset().mockResolvedValue({ id: USER_ID, email: null });
  withTransaction
    .mockReset()
    .mockImplementation((fn: (tx: unknown) => unknown) => fn({}));
  q.lockMemberForQueue.mockResolvedValue("pre_draft");
});

describe("DELETE /api/leagues/[leagueId]/queue/[submissionId]", () => {
  it("400 for bad ids and 401 when signed out", async () => {
    expect((await call("nope")).status).toBe(400);
    expect((await call(LEAGUE_ID, "nope")).status).toBe(400);
    getSessionUser.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("removes only the caller's own item", async () => {
    expect(await (await call()).json()).toEqual({ ok: true });
    expect(q.deleteQueueItem).toHaveBeenCalledWith(
      {},
      LEAGUE_ID,
      USER_ID,
      SUBMISSION_ID,
    );
  });

  it("succeeds when the square was not queued (the query is a no-op)", async () => {
    q.deleteQueueItem.mockResolvedValue(undefined);
    expect((await call()).status).toBe(200);
  });

  it("404 for a non-member", async () => {
    q.lockMemberForQueue.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
    expect(q.deleteQueueItem).not.toHaveBeenCalled();
  });

  it("409 after the draft starts", async () => {
    q.lockMemberForQueue.mockResolvedValue("drafting");
    expect((await call()).status).toBe(409);
    expect(q.deleteQueueItem).not.toHaveBeenCalled();
  });
});
