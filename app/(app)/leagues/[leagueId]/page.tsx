import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberList } from "@/components/leagues/MemberList";
import { ConfirmAction } from "@/components/leagues/ConfirmAction";
import { InvitePanel } from "@/components/leagues/InvitePanel";
import { STATUS_LABEL, STATUS_TONE } from "@/components/leagues/status";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getSessionUser } from "@/lib/auth/session";
import { getLeague, listMembers } from "@/lib/leagues/read";
import { countPool } from "@/lib/pool/read";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function LeagueOverviewPage({
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
  const me = members.find((m) => m.userId === user.id);
  if (me === undefined) {
    notFound();
  }
  const preDraft = league.status === "pre_draft";
  const poolSize = await countPool(leagueId);

  return (
    <>
      <PageHeader
        title={league.name}
        subtitle={`${members.length} ${members.length === 1 ? "player" : "players"}`}
        actions={
          <Badge tone={STATUS_TONE[league.status]}>
            {STATUS_LABEL[league.status]}
          </Badge>
        }
      />
      <div className={styles.grid}>
        <Panel title="Players">
          <MemberList
            leagueId={leagueId}
            members={members}
            viewerId={user.id}
            viewerRole={me.role}
            status={league.status}
          />
        </Panel>
        <div className={styles.side}>
          <Panel title="Draft">
            <p className={styles.date}>
              {league.draftAt ? (
                <LocalTime iso={league.draftAt} />
              ) : (
                "Date to be set"
              )}
            </p>
          </Panel>
          <Panel title="Pool">
            <p className={styles.date}>
              {poolSize} {poolSize === 1 ? "square" : "squares"}
            </p>
            <p>
              <Link href={`/leagues/${leagueId}/pool`}>
                {me.role === "admin" && preDraft
                  ? "Manage the pool"
                  : "View the pool"}
              </Link>
            </p>
          </Panel>
          {preDraft ? (
            <Panel title="Invite players">
              <InvitePanel code={league.joinCode} />
            </Panel>
          ) : null}
          {preDraft && me.role === "member" ? (
            <Panel title="Leave league">
              <ConfirmAction
                label="Leave league"
                variant="danger"
                title="Leave this league?"
                confirmLabel="Leave"
                request={{
                  url: `/api/leagues/${leagueId}/leave`,
                  method: "POST",
                }}
                after={{ kind: "go", to: "/" }}
                successMessage="You left the league."
              >
                <p>
                  You can rejoin later with the join code until the draft
                  starts.
                </p>
              </ConfirmAction>
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
