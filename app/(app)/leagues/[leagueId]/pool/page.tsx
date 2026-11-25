import { notFound } from "next/navigation";
import { AddSubmissionForm } from "@/components/pool/AddSubmissionForm";
import { ClearPoolButton } from "@/components/pool/ClearPoolButton";
import { ImportCsvPanel } from "@/components/pool/ImportCsvPanel";
import { SubmissionList } from "@/components/pool/SubmissionList";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Panel } from "@/components/ui/Panel";
import { getSessionUser } from "@/lib/auth/session";
import { getLeague, listMembers } from "@/lib/leagues/read";
import { getPoolPage } from "@/lib/pool/read";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function PoolPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { leagueId } = await params;
  const { page: rawPage } = await searchParams;
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
  const canEdit = me.role === "admin" && league.status === "pre_draft";
  const pool = await getPoolPage(leagueId, rawPage);

  return (
    <>
      <PageHeader
        title="Pool"
        subtitle={`${pool.total} ${pool.total === 1 ? "square" : "squares"} in ${league.name}`}
        actions={
          canEdit ? (
            <ClearPoolButton leagueId={leagueId} count={pool.total} />
          ) : undefined
        }
      />
      <div className={styles.layout}>
        {canEdit ? (
          <div className={styles.tools}>
            <Panel title="Add a square">
              <AddSubmissionForm leagueId={leagueId} />
            </Panel>
            <Panel title="Upload CSV">
              <ImportCsvPanel leagueId={leagueId} />
            </Panel>
          </div>
        ) : null}
        <div>
          {pool.total === 0 ? (
            <EmptyState
              title="The pool is empty"
              message={
                canEdit
                  ? "Add squares one at a time or upload a CSV."
                  : "The admin has not added any squares yet."
              }
            />
          ) : (
            <>
              <SubmissionList
                leagueId={leagueId}
                items={pool.items}
                canEdit={canEdit}
              />
              <Pagination
                basePath={`/leagues/${leagueId}/pool`}
                page={pool.page}
                pageCount={pool.pageCount}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
