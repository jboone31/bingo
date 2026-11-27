import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { appendLeagueEvent, displayNameOf } from "@/lib/events/append";
import { memberJoined } from "@/lib/events/payload";
import { assertAllowed } from "@/lib/leagues/guard";
import { normalizeJoinCode } from "@/lib/leagues/joinCode";
import {
  countMembers,
  getMemberRole,
  insertMember,
  lockLeagueByCode,
} from "@/lib/leagues/queries";
import { canJoin } from "@/lib/leagues/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/leagues/join: join by code. Repeating it is a no-op. */
export const POST = handle({
  parse: async (request) => {
    const body = await readJsonObject(request, ["code"]);
    const code = normalizeJoinCode(body.code);
    if (code === null) throw new ApiError("invalid_code", 400);
    return code;
  },
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      const league = await lockLeagueByCode(tx, input);
      if (league === null) throw new ApiError("league_not_found", 404);
      const alreadyMember =
        (await getMemberRole(tx, league.id, user.id)) !== null;
      assertAllowed(
        canJoin({
          status: league.status,
          memberCount: await countMembers(tx, league.id),
          alreadyMember,
        }),
      );
      if (!alreadyMember) {
        await insertMember(tx, league.id, user.id, "member");
        await appendLeagueEvent(
          tx,
          league.id,
          user.id,
          memberJoined(await displayNameOf(tx, user.id)),
        );
      }
      return ok({ leagueId: league.id, alreadyMember });
    }),
});
