import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { settleIfDrafting } from "@/lib/draft/engine.server";
import { assertAllowed } from "@/lib/leagues/guard";
import { deleteQueueItem, lockMemberForQueue } from "@/lib/queue/queries";
import { canEditQueue } from "@/lib/queue/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE: take a square out of the caller's queue. Not being queued is success. */
export const DELETE = handle<
  { leagueId: string; submissionId: string },
  { leagueId: string; submissionId: string }
>({
  parse: (_request, params) => ({
    leagueId: parseUuid(params.leagueId),
    submissionId: parseUuid(params.submissionId),
  }),
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      await settleIfDrafting(tx, input.leagueId);
      const status = await lockMemberForQueue(tx, input.leagueId, user.id);
      if (status === null) throw new ApiError("league_not_found", 404);
      assertAllowed(canEditQueue({ status }));
      await deleteQueueItem(tx, input.leagueId, user.id, input.submissionId);
      return ok();
    }),
});
