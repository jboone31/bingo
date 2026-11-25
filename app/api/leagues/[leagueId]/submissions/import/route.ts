import { NextResponse } from "next/server";
import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { assertAllowed, lockLeagueForMember } from "@/lib/leagues/guard";
import { importCsv } from "@/lib/pool/importCsv";
import { MAX_CSV_BYTES, PREVIEW_ROWS } from "@/lib/pool/limits";
import {
  countSubmissions,
  insertSubmissions,
  recordImport,
} from "@/lib/pool/queries";
import { canAddSubmissions, canEditPool } from "@/lib/pool/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ImportInput {
  leagueId: string;
  requestId: string;
  csv: string;
  dryRun: boolean;
}

/**
 * POST /api/leagues/[leagueId]/submissions/import: the admin adds a CSV to the pool.
 * All or nothing. With `dryRun` it only checks the file and returns a preview.
 */
export const POST = handle<ImportInput, { leagueId: string }>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, ["csv", "requestId", "dryRun"]);
    if (typeof body.csv !== "string") throw new ApiError("invalid_body", 400);
    if (Buffer.byteLength(body.csv, "utf8") > MAX_CSV_BYTES) {
      throw new ApiError("csv_too_large", 413);
    }
    if (body.dryRun !== undefined && typeof body.dryRun !== "boolean") {
      throw new ApiError("invalid_body", 400);
    }
    return {
      leagueId: parseUuid(params.leagueId),
      requestId: parseUuid(body.requestId),
      csv: body.csv,
      dryRun: body.dryRun === true,
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

      const result = importCsv(input.csv);
      if (!result.ok) {
        // File problems are plain data about the file, never database text.
        return NextResponse.json(
          {
            ok: false,
            reason: result.reason,
            errors: result.errors,
            totalErrors: result.totalErrors,
          },
          { status: 422 },
        );
      }
      const currentCount = await countSubmissions(tx, input.leagueId);
      assertAllowed(
        canAddSubmissions({
          status: league.status,
          actorRole: role,
          currentCount,
          adding: result.rows.length,
        }),
      );
      if (input.dryRun) {
        return ok({
          rowCount: result.rows.length,
          preview: result.rows.slice(0, PREVIEW_ROWS),
        });
      }

      const record = await recordImport(
        tx,
        input.leagueId,
        input.requestId,
        result.rows.length,
      );
      if (record.existing) {
        return ok({ imported: record.rowCount, alreadyImported: true });
      }
      await insertSubmissions(tx, input.leagueId, record.importId, result.rows);
      return ok({ imported: result.rows.length }, 201);
    }),
});
