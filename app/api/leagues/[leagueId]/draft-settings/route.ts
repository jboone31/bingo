import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { setDraftSettings } from "@/lib/draft/queries";
import { canChangeDraftSettings } from "@/lib/draft/rules";
import { parseGroupCount, parsePickSeconds } from "@/lib/draft/settings";
import { appendLeagueEvent } from "@/lib/events/append";
import { draftSettingsChanged } from "@/lib/events/payload";
import { assertAllowed, lockLeagueForMember } from "@/lib/leagues/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SettingsInput {
  leagueId: string;
  groupCount?: number;
  pickSeconds?: number;
}

/**
 * PATCH /api/leagues/[leagueId]/draft-settings. The admin changes the group count
 * and/or pick timer while pre_draft. Appends `draft_settings_changed` only when a
 * value changed.
 */
export const PATCH = handle<SettingsInput, { leagueId: string }>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, ["groupCount", "pickSeconds"]);
    const input: SettingsInput = { leagueId: parseUuid(params.leagueId) };
    if (Object.hasOwn(body, "groupCount")) {
      const r = parseGroupCount(body.groupCount);
      if (!r.ok) throw new ApiError("invalid_group_count", 400);
      input.groupCount = r.value;
    }
    if (Object.hasOwn(body, "pickSeconds")) {
      const r = parsePickSeconds(body.pickSeconds);
      if (!r.ok) throw new ApiError("invalid_pick_seconds", 400);
      input.pickSeconds = r.value;
    }
    if (input.groupCount === undefined && input.pickSeconds === undefined) {
      throw new ApiError("invalid_body", 400);
    }
    return input;
  },
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      const { league, role } = await lockLeagueForMember(
        tx,
        input.leagueId,
        user.id,
      );
      assertAllowed(
        canChangeDraftSettings({ status: league.status, actorRole: role }),
      );
      const groupCount = input.groupCount ?? league.groupCount;
      const pickSeconds = input.pickSeconds ?? league.pickSeconds;
      const changed = await setDraftSettings(tx, input.leagueId, {
        groupCount: input.groupCount,
        pickSeconds: input.pickSeconds,
      });
      if (changed) {
        await appendLeagueEvent(
          tx,
          input.leagueId,
          user.id,
          draftSettingsChanged(groupCount, pickSeconds),
        );
      }
      return ok({ groupCount, pickSeconds });
    }),
});
