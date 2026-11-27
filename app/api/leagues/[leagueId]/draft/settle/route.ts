import { readJsonObject } from "@/lib/api/body";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { databaseNow, settleLeague } from "@/lib/draft/engine.server";
import { lockLeagueForMember } from "@/lib/leagues/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/leagues/[leagueId]/draft/settle. Any member nudges the engine after a
 * deadline. Safe to call at any time. Returns the database clock, so the caller can
 * refine its offset, and how many auto-picks were made.
 */
export const POST = handle<string, { leagueId: string }>({
  parse: async (request, params) => {
    await readJsonObject(request, []);
    return parseUuid(params.leagueId);
  },
  run: async ({ user, input: leagueId }) =>
    withTransaction(async (tx) => {
      await lockLeagueForMember(tx, leagueId, user.id);
      const picks = await settleLeague(tx, leagueId);
      const response = ok({ now: await databaseNow(tx), picks });
      response.headers.set("Cache-Control", "no-store");
      return response;
    }),
});
