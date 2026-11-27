import Link from "next/link";
import { notFound } from "next/navigation";
import { DraftGroups } from "@/components/draft/DraftGroups";
import { DraftStatus } from "@/components/draft/DraftStatus";
import { DevDraftPanel } from "@/components/dev/DevDraftPanel";
import { GateSummary } from "@/components/draft/GateSummary";
import { ActivityFeed } from "@/components/leagues/ActivityFeed";
import { MemberList } from "@/components/leagues/MemberList";
import { ConfirmAction } from "@/components/leagues/ConfirmAction";
import { InvitePanel } from "@/components/leagues/InvitePanel";
import { STATUS_LABEL, STATUS_TONE } from "@/components/leagues/status";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getSessionUser } from "@/lib/auth/session";
import { getDraftGroups, getDraftStatus } from "@/lib/draft/read";
import { isDevToolsEnabled } from "@/lib/env";
import { getRecentEvents } from "@/lib/events/read";
import { RECENT_EVENTS } from "@/lib/events/types";
import { getLeague, listMembers } from "@/lib/leagues/read";
import { countPool } from "@/lib/pool/read";
import { countQueue } from "@/lib/queue/read";
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
  const drafting = league.status === "drafting";
  const [poolSize, queueSize, recentEvents, groups, draftStatus] =
    await Promise.all([
      countPool(leagueId),
      countQueue(leagueId, user.id),
      getRecentEvents(leagueId, RECENT_EVENTS),
      preDraft ? Promise.resolve([]) : getDraftGroups(leagueId),
      drafting ? getDraftStatus(leagueId) : Promise.resolve([]),
    ]);
  const showDevDraft =
    drafting &&
    me.role === "admin" &&
    league.seedScenario !== null &&
    isDevToolsEnabled();

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
      {preDraft ? null : (
        <div className={styles.wide}>
          <Panel title="Draft status">
            <DraftStatus
              leagueId={leagueId}
              groups={draftStatus}
              viewerId={user.id}
              completed={league.status === "in_progress"}
            />
          </Panel>
        </div>
      )}
      {showDevDraft ? (
        <div className={styles.wide}>
          <Panel title="Dev draft controls">
            <DevDraftPanel leagueId={leagueId} bots={league.devBots} />
          </Panel>
        </div>
      ) : null}
      {preDraft ? null : (
        <div className={styles.wide}>
          <Panel title="Draft groups">
            <DraftGroups groups={groups} viewerId={user.id} />
          </Panel>
        </div>
      )}
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
            {preDraft ? (
              <GateSummary
                members={members.length}
                groups={league.groupCount}
                pickSeconds={league.pickSeconds}
                pool={poolSize}
              />
            ) : null}
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
          <Panel title="My queue">
            <p className={styles.date}>
              {queueSize} {queueSize === 1 ? "square" : "squares"}
            </p>
            <p>
              <Link href={`/leagues/${leagueId}/queue`}>
                {preDraft ? "Rank your queue" : "View your queue"}
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
          <Panel title="Activity">
            <ActivityFeed leagueId={leagueId} initial={recentEvents} />
          </Panel>
        </div>
      </div>
    </>
  );
}
