import { NextRequest } from "next/server";
import { vi } from "vitest";

/** Fixed ids for route tests. */
export const LEAGUE_ID = "11111111-1111-4111-8111-111111111111";
export const USER_ID = "22222222-2222-4222-8222-222222222222";
export const OTHER_ID = "33333333-3333-4333-8333-333333333333";

/** A JSON request. Pass `body` as a string to send it unchanged. */
export function jsonRequest(
  method: string,
  body?: unknown,
  url = "http://localhost/api/x",
): NextRequest {
  return new NextRequest(url, {
    method,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

/** The query functions the routes call, all mocked. */
export function mockQueries() {
  return {
    lockLeagueById: vi.fn(),
    lockLeagueByCode: vi.fn(),
    getMemberRole: vi.fn(),
    countMembers: vi.fn(),
    insertMember: vi.fn(),
    deleteMember: vi.fn().mockResolvedValue(true),
    setRole: vi.fn(),
    setJoinCode: vi.fn(),
    setDraftAt: vi.fn().mockResolvedValue(true),
    deleteLeague: vi.fn(),
    createLeague: vi.fn(),
  };
}

export const league = (over: Record<string, unknown> = {}) => ({
  id: LEAGUE_ID,
  name: "Office 2026",
  status: "pre_draft",
  draftAt: null,
  joinCode: "K7P2QX9M",
  groupCount: 1,
  pickSeconds: 60,
  draftStartedAt: null,
  ...over,
});

export const SUBMISSION_ID = "55555555-5555-4555-8555-555555555555";
export const REQUEST_ID = "44444444-4444-4444-8444-444444444444";

/** The pool query functions the routes call, all mocked. */
export function mockPoolQueries() {
  return {
    recordImport: vi.fn(),
    insertSubmissions: vi.fn(),
    countSubmissions: vi.fn(),
    firstSubmissionOfImport: vi.fn(),
    updateSubmission: vi.fn(),
    deleteSubmission: vi.fn().mockResolvedValue(true),
    deleteAllSubmissions: vi.fn(),
  };
}

/** The queue query functions the routes call, all mocked. */
export function mockQueueQueries() {
  return {
    lockMemberForQueue: vi.fn(),
    submissionInLeague: vi.fn(),
    getQueueIds: vi.fn(),
    insertQueueItem: vi.fn(),
    deleteQueueItem: vi.fn(),
    rewriteOrder: vi.fn(),
  };
}
/** The event helpers the routes call (`@/lib/events/append`), all mocked. */
export function mockEvents() {
  return {
    appendLeagueEvent: vi.fn().mockResolvedValue(1),
    displayNameOf: vi.fn().mockResolvedValue("Sam"),
  };
}
