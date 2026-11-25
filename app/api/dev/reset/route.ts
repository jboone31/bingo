import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { assertDevTools } from "@/lib/dev/gate";
import { resetAll, resetMine } from "@/lib/dev/reset";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Scope = "mine" | "all";

/** POST /api/dev/reset: remove seed leagues (yours, or all plus seed users). */
export const POST = handle<Scope>({
  parse: async (request) => {
    assertDevTools();
    const body = await readJsonObject(request, ["scope"]);
    if (body.scope !== "mine" && body.scope !== "all") {
      throw new ApiError("invalid_body", 400);
    }
    return body.scope;
  },
  run: async ({ user, input }) => {
    if (input === "mine") {
      const leagues = await withTransaction((tx) => resetMine(tx, user.id));
      return ok({ leagues, users: 0 });
    }
    return ok({ ...(await resetAll()) });
  },
});
