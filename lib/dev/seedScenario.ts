import "server-only";
import { randomUUID } from "node:crypto";
import { withTransaction } from "@/lib/db/server";
import { createLeague } from "@/lib/leagues/queries";
import { insertSubmissions, recordImport } from "@/lib/pool/queries";
import { planFor, seedPoolRows, seedQueueOrder } from "./scenarios";
import { insertSeedEvents } from "./seedEvents";
import { insertSeedQueue } from "./seedQueue";
import { ensureSeedUsers } from "./seedUsers";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Build one scenario league for `viewerId`. Uses the real tables and triggers, so
 * it cannot make a state the app could not reach. Returns the new league id, or
 * `null` for an unknown scenario.
 */
export async function seedScenario(
  viewerId: string,
  scenario: string,
): Promise<string | null> {
  const plan = planFor(scenario);
  if (plan === null) return null;

  const fakes = await ensureSeedUsers(plan.fakeMembers);
  const adminId = plan.fakeAdmin ? fakes[0] : viewerId;
  // Everyone besides the admin joins as a regular member.
  const others = plan.fakeAdmin ? [viewerId, ...fakes.slice(1)] : fakes;
  const draftAt =
    plan.draftAtOffsetDays === null
      ? null
      : new Date(Date.now() + plan.draftAtOffsetDays * DAY_MS).toISOString();

  return withTransaction(async (tx) => {
    const { id } = await createLeague(tx, {
      name: plan.leagueName,
      draftAt,
      userId: adminId,
      requestId: randomUUID(),
      seedScenario: scenario,
    });
    if (others.length > 0) {
      await tx.query(
        `insert into public.league_members (league_id, user_id, role)
         select $1, u, 'member' from unnest($2::uuid[]) as u`,
        [id, others],
      );
    }
    if (plan.poolSubmissions > 0) {
      const rows = seedPoolRows(plan.poolSubmissions);
      const record = await recordImport(tx, id, randomUUID(), rows.length);
      const submissionIds = await insertSubmissions(
        tx,
        id,
        record.importId,
        rows,
      );
      // Queues: you first, then each seed player, each in a different scrambled order.
      const owners = [
        { userId: viewerId, size: plan.viewerQueueSize },
        ...fakes.map((userId) => ({ userId, size: plan.fakeQueueSize })),
      ];
      for (const [salt, owner] of owners.entries()) {
        const picks = seedQueueOrder(
          submissionIds.length,
          owner.size,
          salt + 1,
        );
        await insertSeedQueue(
          tx,
          id,
          owner.userId,
          picks.map((index) => submissionIds[index]),
        );
      }
    }
    if (plan.eventCount > 0) {
      await insertSeedEvents(tx, id, plan.eventCount, [adminId, ...others]);
    }
    return id;
  });
}
