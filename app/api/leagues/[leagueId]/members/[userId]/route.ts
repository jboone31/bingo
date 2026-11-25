import { handle } from "@/lib/api/handler";
import { parseUuid } from "@/lib/api/ids";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
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
        await deleteMember(tx, input.leagueId, input.targetId);
      }
      return ok();
    }),
});
