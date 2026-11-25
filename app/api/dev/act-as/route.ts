import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { actAs } from "@/lib/dev/actAs";
import { assertDevTools } from "@/lib/dev/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/dev/act-as: switch this browser to a seed user. Seed users only. */
export const POST = handle({
  parse: async (request) => {
    assertDevTools();
    const body = await readJsonObject(request, ["userId"]);
    return parseUuid(body.userId);
  },
  run: async ({ input }) => {
    if (!(await actAs(input))) {
      throw new ApiError("not_found", 404);
    }
    return ok();
  },
});
