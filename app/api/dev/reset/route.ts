import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { assertDevTools } from "@/lib/dev/gate";
import { resetAll, resetMine, resetOne } from "@/lib/dev/reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Input =
  { scope: "mine" } | { scope: "all" } | { scope: "league"; leagueId: string };

/**
 * POST /api/dev/reset: remove seed leagues. `mine` removes yours, `league` removes
 * one of yours (any status), `all` removes every seed league plus the seed users.
 * Leagues without a seed tag are never touched.
 */
export const POST = handle<Input>({
  parse: async (request) => {
    assertDevTools();
    const body = await readJsonObject(request, ["scope", "leagueId"]);
    if (body.scope === "league") {
      return { scope: "league", leagueId: parseUuid(body.leagueId) };
    }
    if (Object.hasOwn(body, "leagueId"))
      throw new ApiError("invalid_body", 400);
    if (body.scope === "mine" || body.scope === "all")
      return { scope: body.scope };
    throw new ApiError("invalid_body", 400);
  },
  run: async ({ user, input }) => {
    if (input.scope === "league") {
      const removed = await withTransaction((tx) =>
        resetOne(tx, user.id, input.leagueId),
      );
      if (!removed) throw new ApiError("league_not_found", 404);
      return ok({ leagues: 1, users: 0 });
    }
    if (input.scope === "mine") {
      const leagues = await withTransaction((tx) => resetMine(tx, user.id));
      return ok({ leagues, users: 0 });
    }
    return ok({ ...(await resetAll()) });
  },
});
