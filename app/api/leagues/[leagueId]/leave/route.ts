import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { appendLeagueEvent, displayNameOf } from "@/lib/events/append";
import { memberLeft } from "@/lib/events/payload";
import { assertAllowed } from "@/lib/leagues/guard";
import {
  deleteMember,
  getMemberRole,
  lockLeagueById,
} from "@/lib/leagues/queries";
import { canLeave } from "@/lib/leagues/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leagues/[leagueId]/leave. Leaving when not a member succeeds, with
 * the same answer whether or not the league exists.
 */
export const POST = handle<string, { leagueId: string }>({
  parse: (_request, params) => parseUuid(params.leagueId),
  run: async ({ user, input: leagueId }) =>
    withTransaction(async (tx) => {
      const league = await lockLeagueById(tx, leagueId);
      const role = league ? await getMemberRole(tx, leagueId, user.id) : null;
      if (league === null || role === null) return ok();
      assertAllowed(canLeave({ status: league.status, role }));
      if (await deleteMember(tx, leagueId, user.id)) {
        await appendLeagueEvent(
          tx,
          leagueId,
          user.id,
          memberLeft(await displayNameOf(tx, user.id)),
        );
      }
      return ok();
    }),
});
