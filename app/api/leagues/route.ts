import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { parseDraftAt } from "@/lib/leagues/draftAt";
import { parseLeagueName } from "@/lib/leagues/name";
import { createLeague } from "@/lib/leagues/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/leagues: create a league; the caller becomes its admin. */
export const POST = handle({
  parse: async (request) => {
    const body = await readJsonObject(request, [
      "name",
      "draftAt",
      "requestId",
    ]);
    const name = parseLeagueName(body.name);
    if (!name.ok) throw new ApiError(name.reason, 400);
    const draftAt = parseDraftAt(body.draftAt);
    if (!draftAt.ok) throw new ApiError(draftAt.reason, 400);
    return {
      name: name.value,
      draftAt: draftAt.value,
      requestId: parseUuid(body.requestId),
    };
  },
  run: async ({ user, input }) => {
    const result = await withTransaction((tx) =>
      createLeague(tx, { ...input, userId: user.id }),
    );
    return ok({ league: { id: result.id } }, result.created ? 201 : 200);
  },
});
