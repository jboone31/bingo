import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { appendLeagueEvent } from "@/lib/events/append";
import { joinCodeRegenerated } from "@/lib/events/payload";
import { assertAllowed, lockLeagueForMember } from "@/lib/leagues/guard";
import { setJoinCode } from "@/lib/leagues/queries";
import { canRegenerateCode } from "@/lib/leagues/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/leagues/[leagueId]/join-code: replace the code; the old one stops working. */
export const POST = handle<string, { leagueId: string }>({
  parse: (_request, params) => parseUuid(params.leagueId),
  run: async ({ user, input: leagueId }) =>
    withTransaction(async (tx) => {
      const { league, role } = await lockLeagueForMember(tx, leagueId, user.id);
      assertAllowed(
        canRegenerateCode({ status: league.status, actorRole: role }),
      );
      const joinCode = await setJoinCode(tx, leagueId);
      await appendLeagueEvent(tx, leagueId, user.id, joinCodeRegenerated());
      return ok({ joinCode });
    }),
});
