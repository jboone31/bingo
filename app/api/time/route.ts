import { handle } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/time. The server clock in milliseconds, for signed-in users. Clients
 * estimate their offset from it (`lib/time/clockOffset.ts`) so countdowns follow
 * server time. Never cached.
 */
export const GET = handle<null>({
  parse: () => null,
  run: async () => {
    const response = ok({ now: Date.now() });
    response.headers.set("Cache-Control", "no-store");
    return response;
  },
});
