import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { assertAllowed, lockLeagueForMember } from "@/lib/leagues/guard";
import { deleteLeague } from "@/lib/leagues/queries";
import { canDelete } from "@/lib/leagues/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/leagues/[leagueId]: the admin deletes a pre_draft league by typing its
 * name. A second call finds no league and returns `league_not_found`.
 */
export const DELETE = handle<
  { leagueId: string; confirmName: string },
  { leagueId: string }
>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, ["confirmName"]);
    if (typeof body.confirmName !== "string") {
      throw new ApiError("invalid_body", 400);
    }
    return {
      leagueId: parseUuid(params.leagueId),
      confirmName: body.confirmName,
    };
  },
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      const { league, role } = await lockLeagueForMember(
        tx,
        input.leagueId,
        user.id,
      );
      assertAllowed(
        canDelete({
          status: league.status,
          actorRole: role,
          confirmName: input.confirmName,
          leagueName: league.name,
        }),
      );
      await deleteLeague(tx, input.leagueId);
      return ok();
    }),
});
