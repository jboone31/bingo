import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { makePick } from "@/lib/draft/engine.server";
import { lockLeagueForMember } from "@/lib/leagues/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PickInput {
  leagueId: string;
  submissionId: string;
  pickNumber: number;
}

/**
 * POST /api/leagues/[leagueId]/draft/pick. The caller picks a square for their
 * group's current pick. `pickNumber` makes a repeat safe: the same request again
 * succeeds with `alreadyPicked`, and a request for a turn that has passed is refused.
 */
export const POST = handle<PickInput, { leagueId: string }>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, ["submissionId", "pickNumber"]);
    const pickNumber = body.pickNumber;
    if (
      typeof pickNumber !== "number" ||
      !Number.isInteger(pickNumber) ||
      pickNumber < 1 ||
      pickNumber > 2500
    ) {
      throw new ApiError("invalid_body", 400);
    }
    return {
      leagueId: parseUuid(params.leagueId),
      submissionId: parseUuid(body.submissionId),
      pickNumber,
    };
  },
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      await lockLeagueForMember(tx, input.leagueId, user.id);
      const result = await makePick(tx, {
        leagueId: input.leagueId,
        userId: user.id,
        submissionId: input.submissionId,
        pickNumber: input.pickNumber,
      });
      return result.alreadyPicked
        ? ok({ pickNumber: input.pickNumber, alreadyPicked: true })
        : ok({ pickNumber: input.pickNumber });
    }),
});
