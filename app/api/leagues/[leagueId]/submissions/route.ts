import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { appendLeagueEvent } from "@/lib/events/append";
import { poolChanged } from "@/lib/events/payload";
import { assertAllowed, lockLeagueForMember } from "@/lib/leagues/guard";
import { parseCategory, parseSubmitter, parseText } from "@/lib/pool/fields";
import {
  countSubmissions,
  deleteAllSubmissions,
  firstSubmissionOfImport,
  insertSubmissions,
  recordImport,
} from "@/lib/pool/queries";
import { canAddSubmissions, canEditPool } from "@/lib/pool/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AddInput {
  leagueId: string;
  requestId: string;
  text: string;
  submitter: string;
  category: string;
}

/**
 * POST /api/leagues/[leagueId]/submissions: the admin adds one submission. The
 * request id makes a repeat harmless even though duplicates are otherwise allowed.
 */
export const POST = handle<AddInput, { leagueId: string }>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, [
      "text",
      "submitter",
      "category",
      "requestId",
    ]);
    const text = parseText(body.text);
    if (!text.ok) throw new ApiError(text.reason, 400);
    const submitter = parseSubmitter(body.submitter);
    if (!submitter.ok) throw new ApiError(submitter.reason, 400);
    const category = parseCategory(body.category);
    if (!category.ok) throw new ApiError(category.reason, 400);
    return {
      leagueId: parseUuid(params.leagueId),
      requestId: parseUuid(body.requestId),
      text: text.value,
      submitter: submitter.value,
      category: category.value,
    };
  },
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      const { league, role } = await lockLeagueForMember(
        tx,
        input.leagueId,
        user.id,
      );
      assertAllowed(canEditPool({ status: league.status, actorRole: role }));
      const record = await recordImport(tx, input.leagueId, input.requestId, 1);
      if (record.existing) {
        const id = await firstSubmissionOfImport(tx, record.importId);
        return ok({ submission: { id }, alreadyAdded: true });
      }
      assertAllowed(
        canAddSubmissions({
          status: league.status,
          actorRole: role,
          currentCount: await countSubmissions(tx, input.leagueId),
          adding: 1,
        }),
      );
      const [id] = await insertSubmissions(
        tx,
        input.leagueId,
        record.importId,
        [
          {
            text: input.text,
            submitter: input.submitter,
            category: input.category,
          },
        ],
      );
      await appendLeagueEvent(
        tx,
        input.leagueId,
        user.id,
        poolChanged("added", 1),
      );
      return ok({ submission: { id } }, 201);
    }),
});

/** DELETE /api/leagues/[leagueId]/submissions: the admin clears the whole pool. */
export const DELETE = handle<string, { leagueId: string }>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, ["all"]);
    if (body.all !== true) throw new ApiError("invalid_body", 400);
    return parseUuid(params.leagueId);
  },
  run: async ({ user, input: leagueId }) =>
    withTransaction(async (tx) => {
      const { league, role } = await lockLeagueForMember(tx, leagueId, user.id);
      assertAllowed(canEditPool({ status: league.status, actorRole: role }));
      const deleted = await deleteAllSubmissions(tx, leagueId);
      if (deleted > 0) {
        await appendLeagueEvent(
          tx,
          leagueId,
          user.id,
          poolChanged("cleared", deleted),
        );
      }
      return ok({ deleted });
    }),
});
