import { readJsonObject } from "@/lib/api/body";
import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { appendLeagueEvent, displayNameOf } from "@/lib/events/append";
import { adminTransferred } from "@/lib/events/payload";
import { assertAllowed, lockLeagueForMember } from "@/lib/leagues/guard";
import { getMemberRole, setRole } from "@/lib/leagues/queries";
import { canTransfer } from "@/lib/leagues/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/leagues/[leagueId]/transfer: hand admin to another member. */
export const POST = handle<
  { leagueId: string; targetId: string },
  { leagueId: string }
>({
  parse: async (request, params) => {
    const body = await readJsonObject(request, ["userId"]);
    return {
      leagueId: parseUuid(params.leagueId),
      targetId: parseUuid(body.userId),
    };
  },
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      const { role } = await lockLeagueForMember(tx, input.leagueId, user.id);
      const target = await getMemberRole(tx, input.leagueId, input.targetId);
      assertAllowed(
        canTransfer({ actorRole: role, targetIsMember: target !== null }),
      );
      // The target already being admin means it is the caller: nothing to do.
      if (target !== "admin") {
        // Demote first so the one-admin unique index is never violated.
        await setRole(tx, input.leagueId, user.id, "member");
        await setRole(tx, input.leagueId, input.targetId, "admin");
        await appendLeagueEvent(
          tx,
          input.leagueId,
          user.id,
          adminTransferred(
            await displayNameOf(tx, user.id),
            await displayNameOf(tx, input.targetId),
          ),
        );
      }
      return ok();
    }),
});
