import { notFound } from "next/navigation";
import { DraftDateLine } from "@/components/leagues/DraftDateLine";
import { QueueList } from "@/components/queue/QueueList";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSessionUser } from "@/lib/auth/session";
import { getLeague, listMembers } from "@/lib/leagues/read";
import { getQueue } from "@/lib/queue/read";

export const dynamic = "force-dynamic";

/** The signed-in member's own queue. Private: RLS shows it to its owner only. */
export default async function QueuePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const user = await getSessionUser();
  const league = await getLeague(leagueId);
  if (user === null || league === null) {
    notFound();
  }
  const members = await listMembers(leagueId);
  if (!members.some((m) => m.userId === user.id)) {
    notFound();
  }
  const items = await getQueue(leagueId, user.id);
  // Queues can change until the draft is over (F7).
  const editable = league.status !== "in_progress";

  return (
    <>
      <PageHeader
        title="My queue"
        subtitle={
          editable
            ? "Drag the handle or use the arrows to rank the squares you want."
            : "The draft is over. Your queue is read only."
        }
      />
      <DraftDateLine draftAt={league.draftAt} />
      <QueueList
        // A new key starts the list over from the server's data after a reload.
        key={items.map((item) => item.id).join(",")}
        leagueId={leagueId}
        items={items}
        editable={editable}
        poolHref={`/leagues/${leagueId}/pool`}
      />
    </>
  );
}
