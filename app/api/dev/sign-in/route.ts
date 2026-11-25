import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handlePublic } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { actAs } from "@/lib/dev/actAs";
import { assertDevTools } from "@/lib/dev/gate";
import { isPrivateHost } from "@/lib/dev/privateHost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/dev/sign-in: sign in as a seed player without Google, so a phone on the
 * local network can be tested when the OAuth redirect is not set up for it. Works
 * with no session, so it is double gated: dev tools must be on (never on Vercel
 * Production), and the request must come from a local or private-network host. Only
 * seed players can be signed in as; `actAs` re-checks that against the database.
 */
export const POST = handlePublic({
  parse: async (request) => {
    assertDevTools();
    if (!isPrivateHost(request.headers.get("host"))) {
      throw new ApiError("not_found", 404);
    }
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
