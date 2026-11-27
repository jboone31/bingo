import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { devExpire, setDevBots } from "@/lib/draft/engine.server";
import { assertDevTools } from "@/lib/dev/gate";
import { lockMySeedLeague } from "@/lib/dev/reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = ["expire", "bots_on", "bots_off"] as const;
type Action = (typeof ACTIONS)[number];

/**
 * POST /api/dev/draft: dev controls for a seed league's draft. `expire` makes every
 * running turn due now; `bots_on` / `bots_off` let seed players pick at once. Each
 * settles afterwards. Only seed leagues the caller belongs to.
 */
export const POST = handle<{ leagueId: string; action: Action }>({
  parse: async (request) => {
    assertDevTools();
    const body = await readJsonObject(request, ["leagueId", "action"]);
    if (!ACTIONS.includes(body.action as Action)) {
      throw new ApiError("invalid_body", 400);
    }
    return {
      leagueId: parseUuid(body.leagueId),
      action: body.action as Action,
    };
  },
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      if (!(await lockMySeedLeague(tx, user.id, input.leagueId))) {
        throw new ApiError("league_not_found", 404);
      }
      const picks =
        input.action === "expire"
          ? await devExpire(tx, input.leagueId)
          : await setDevBots(tx, input.leagueId, input.action === "bots_on");
      return ok({ picks });
    }),
});
