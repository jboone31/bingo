import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { appendLeagueEvent, displayNameOf } from "@/lib/events/append";
import { memberRemoved } from "@/lib/events/payload";
import { assertAllowed, lockLeagueForMember } from "@/lib/leagues/guard";
import { deleteMember, getMemberRole } from "@/lib/leagues/queries";
import { canRemove } from "@/lib/leagues/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DELETE /api/leagues/[leagueId]/members/[userId]: the admin removes a member. */
export const DELETE = handle<
  { leagueId: string; targetId: string },
  { leagueId: string; userId: string }
>({
  parse: (_request, params) => ({
    leagueId: parseUuid(params.leagueId),
    targetId: parseUuid(params.userId),
  }),
  run: async ({ user, input }) =>
    withTransaction(async (tx) => {
      const { league, role } = await lockLeagueForMember(
        tx,
        input.leagueId,
        user.id,
      );
      assertAllowed(
        canRemove({
          status: league.status,
          actorRole: role,
          isSelf: input.targetId === user.id,
        }),
      );
      const target = await getMemberRole(tx, input.leagueId, input.targetId);
      if (target !== null) {
        const name = await displayNameOf(tx, input.targetId);
        if (await deleteMember(tx, input.leagueId, input.targetId)) {
          await appendLeagueEvent(
            tx,
            input.leagueId,
            user.id,
            memberRemoved(name),
          );
        }
      }
      return ok();
    }),
});
