import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { GROUP_COUNT } from "@/lib/draft/settings";
import { startDraft, type StartExpectation } from "@/lib/draft/start";
import { MAX_MEMBERS } from "@/lib/leagues/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const isCount = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

/**
 * POST /api/leagues/[leagueId]/start. The admin starts the draft. `expected` is the
 * player and group counts the admin confirmed; the start is refused if either has
 * changed. Repeating a start succeeds with `alreadyStarted: true`.
 */
export const POST = handle<
  { leagueId: string; expected: StartExpectation },
  { leagueId: string }
>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, ["expected"]);
    const expected = body.expected as
      Record<string, unknown> | null | undefined;
    if (
      typeof expected !== "object" ||
      expected === null ||
      Array.isArray(expected) ||
      Object.keys(expected).some(
        (k) => k !== "members" && k !== "groupCount",
      ) ||
      !isCount(expected.members, 1, MAX_MEMBERS) ||
      !isCount(expected.groupCount, GROUP_COUNT.min, GROUP_COUNT.max)
    ) {
      throw new ApiError("invalid_body", 400);
    }
    return {
      leagueId: parseUuid(params.leagueId),
      expected: {
        members: expected.members,
        groupCount: expected.groupCount,
      },
    };
  },
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      const result = await startDraft(
        tx,
        input.leagueId,
        user.id,
        input.expected,
      );
      return result.alreadyStarted ? ok({ alreadyStarted: true }) : ok();
    }),
});
