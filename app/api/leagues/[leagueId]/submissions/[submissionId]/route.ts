import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { assertAllowed, lockLeagueForMember } from "@/lib/leagues/guard";
import { parseCategory, parseSubmitter, parseText } from "@/lib/pool/fields";
import {
  deleteSubmission,
  updateSubmission,
  type SubmissionPatch,
} from "@/lib/pool/queries";
import { canEditPool } from "@/lib/pool/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { leagueId: string; submissionId: string };

/** PATCH: the admin edits any of text, submitter and category on one row. */
export const PATCH = handle<
  { leagueId: string; submissionId: string; patch: SubmissionPatch },
  Params
>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, [
      "text",
      "submitter",
      "category",
    ]);
    const patch: SubmissionPatch = {};
    if (Object.hasOwn(body, "text")) {
      const r = parseText(body.text);
      if (!r.ok) throw new ApiError(r.reason, 400);
      patch.text = r.value;
    }
    if (Object.hasOwn(body, "submitter")) {
      const r = parseSubmitter(body.submitter);
      if (!r.ok) throw new ApiError(r.reason, 400);
      patch.submitter = r.value;
    }
    if (Object.hasOwn(body, "category")) {
      const r = parseCategory(body.category);
      if (!r.ok) throw new ApiError(r.reason, 400);
      patch.category = r.value;
    }
    if (Object.keys(patch).length === 0) {
      throw new ApiError("invalid_body", 400);
    }
    return {
      leagueId: parseUuid(params.leagueId),
      submissionId: parseUuid(params.submissionId),
      patch,
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
      const found = await updateSubmission(
        tx,
        input.leagueId,
        input.submissionId,
        input.patch,
      );
      if (!found) throw new ApiError("submission_not_found", 404);
      return ok();
    }),
});

/** DELETE: the admin removes one row. Removing a row that is gone succeeds. */
export const DELETE = handle<
  { leagueId: string; submissionId: string },
  Params
>({
  parse: (_request, params) => ({
    leagueId: parseUuid(params.leagueId),
    submissionId: parseUuid(params.submissionId),
  }),
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      const { league, role } = await lockLeagueForMember(
        tx,
        input.leagueId,
        user.id,
      );
      assertAllowed(canEditPool({ status: league.status, actorRole: role }));
      await deleteSubmission(tx, input.leagueId, input.submissionId);
      return ok();
    }),
});
