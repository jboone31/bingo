import { notFound } from "next/navigation";
import { DraftSetupPanel } from "@/components/draft/DraftSetupPanel";
import { ConfirmAction } from "@/components/leagues/ConfirmAction";
import { DraftDateForm } from "@/components/leagues/DraftDateForm";
import { DeleteLeagueDialog } from "@/components/leagues/DeleteLeagueDialog";
import { InvitePanel } from "@/components/leagues/InvitePanel";
import { TransferAdminForm } from "@/components/leagues/TransferAdminForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getSessionUser } from "@/lib/auth/session";
import { getLeague, listMembers } from "@/lib/leagues/read";
import { countPool } from "@/lib/pool/read";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

/** Admin only. Everyone else gets the not-found page. */
export default async function LeagueSettingsPage({
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
  if (me?.role !== "admin") {
    notFound();
  }
  const preDraft = league.status === "pre_draft";
  const pool = preDraft ? await countPool(leagueId) : 0;

  return (
    <>
      <PageHeader title="Settings" subtitle={league.name} />
      <div className={styles.stack}>
        {preDraft ? (
          <Panel title="Draft setup">
            <DraftSetupPanel
              leagueId={leagueId}
              members={members.length}
              pool={pool}
              groupCount={league.groupCount}
              pickSeconds={league.pickSeconds}
            />
          </Panel>
        ) : null}
        {preDraft ? (
          <Panel title="Draft date">
            <DraftDateForm
              leagueId={leagueId}
              initialDraftAt={league.draftAt}
            />
          </Panel>
        ) : null}
        {preDraft ? (
          <Panel title="Invite code">
            <div className={styles.stack}>
              <InvitePanel code={league.joinCode} />
              <div>
                <ConfirmAction
                  label="Regenerate code"
                  title="Regenerate the join code?"
                  confirmLabel="Regenerate"
                  request={{
                    url: `/api/leagues/${leagueId}/join-code`,
                    method: "POST",
                  }}
                  after={{ kind: "refresh" }}
                  successMessage="New join code created."
                >
                  <p>The current code and invite link will stop working.</p>
                </ConfirmAction>
              </div>
            </div>
          </Panel>
        ) : null}
        <Panel title="Transfer admin">
          <TransferAdminForm
            leagueId={leagueId}
            candidates={members.filter((m) => m.userId !== user.id)}
          />
        </Panel>
        {preDraft ? (
          <Panel title="Danger zone">
            <DeleteLeagueDialog leagueId={leagueId} leagueName={league.name} />
          </Panel>
        ) : null}
      </div>
    </>
  );
}
