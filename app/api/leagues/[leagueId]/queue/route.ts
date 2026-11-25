import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { assertAllowed } from "@/lib/leagues/guard";
import { isPermutation } from "@/lib/queue/order";
import {
  getQueueIds,
  insertQueueItem,
  lockMemberForQueue,
  rewriteOrder,
  submissionInLeague,
} from "@/lib/queue/queries";
import { QUEUE_MAX, canAddToQueue, canEditQueue } from "@/lib/queue/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { leagueId: string };

/** POST: add a square to the end of the caller's queue. Repeating it is harmless. */
export const POST = handle<{ leagueId: string; submissionId: string }, Params>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, ["submissionId"]);
    return {
      leagueId: parseUuid(params.leagueId),
      submissionId: parseUuid(body.submissionId),
    };
  },
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      const status = await lockMemberForQueue(tx, input.leagueId, user.id);
      if (status === null) throw new ApiError("league_not_found", 404);
      assertAllowed(canEditQueue({ status }));
      if (!(await submissionInLeague(tx, input.leagueId, input.submissionId))) {
        throw new ApiError("submission_not_found", 404);
      }
      const current = await getQueueIds(tx, input.leagueId, user.id);
      if (current.includes(input.submissionId)) {
        return ok({ queued: false });
      }
      assertAllowed(canAddToQueue({ status, count: current.length }));
      await insertQueueItem(tx, input.leagueId, user.id, input.submissionId);
      return ok({ queued: true }, 201);
    }),
});

/**
 * PUT: save a new order. `order` must be exactly the current queue, re-arranged.
 * Anything else means the queue changed elsewhere, so nothing is written.
 */
export const PUT = handle<{ leagueId: string; order: string[] }, Params>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, ["order"]);
    if (!Array.isArray(body.order) || body.order.length > QUEUE_MAX) {
      throw new ApiError("invalid_body", 400);
    }
    const order = body.order.map(parseUuid);
    if (new Set(order).size !== order.length) {
      throw new ApiError("invalid_body", 400);
    }
    return { leagueId: parseUuid(params.leagueId), order };
  },
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      const status = await lockMemberForQueue(tx, input.leagueId, user.id);
      if (status === null) throw new ApiError("league_not_found", 404);
      assertAllowed(canEditQueue({ status }));
      const current = await getQueueIds(tx, input.leagueId, user.id);
      if (!isPermutation(current, input.order)) {
        throw new ApiError("queue_changed", 409);
      }
      await rewriteOrder(tx, input.leagueId, user.id, input.order);
      return ok();
    }),
});
