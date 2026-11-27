import { notFound } from "next/navigation";
import { DraftDateLine } from "@/components/leagues/DraftDateLine";
import { AddSubmissionForm } from "@/components/pool/AddSubmissionForm";
import { ClearPoolButton } from "@/components/pool/ClearPoolButton";
import { ImportCsvPanel } from "@/components/pool/ImportCsvPanel";
import { PoolFilterBar } from "@/components/pool/PoolFilterBar";
import { SubmissionList } from "@/components/pool/SubmissionList";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Panel } from "@/components/ui/Panel";
import { getSessionUser } from "@/lib/auth/session";
import { getLeague, listMembers } from "@/lib/leagues/read";
import {
  describeFilter,
  isDefaultQuery,
  parsePoolQuery,
  poolQueryToParams,
} from "@/lib/pool/query";
import { getPoolPage, listCategories } from "@/lib/pool/read";
import { getQueuedIds } from "@/lib/queue/read";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function PoolPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { leagueId } = await params;
  const raw = await searchParams;
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
  const canEdit = me.role === "admin" && preDraft;
  const query = parsePoolQuery(raw);
  const basePath = `/leagues/${leagueId}/pool`;
  const [pool, categories] = await Promise.all([
    getPoolPage(leagueId, query, raw.page),
    listCategories(leagueId),
  ]);
  // Queues can change until the draft is over (F7).
  const queueOpen = league.status !== "in_progress";
  const queuedIds = queueOpen
    ? await getQueuedIds(
        leagueId,
        user.id,
        pool.items.map((item) => item.id),
      )
    : undefined;
  const filtered = !isDefaultQuery(query);

  return (
    <>
      <PageHeader
        title="Pool"
        subtitle={
          filtered
            ? `${pool.total} of ${pool.poolTotal} squares in ${league.name}`
            : `${pool.poolTotal} ${pool.poolTotal === 1 ? "square" : "squares"} in ${league.name}`
        }
        actions={
          canEdit ? (
            <ClearPoolButton leagueId={leagueId} count={pool.poolTotal} />
          ) : undefined
        }
      />
      <DraftDateLine draftAt={league.draftAt} />
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
          {pool.poolTotal === 0 ? (
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
              <PoolFilterBar
                basePath={basePath}
                query={query}
                categories={categories}
              />
              {pool.total === 0 ? (
                <EmptyState
                  title="No squares match"
                  message={`Nothing matches ${describeFilter(query).join(" and ")}.`}
                  action={
                    <ButtonLink href={basePath} variant="secondary">
                      Clear the filter
                    </ButtonLink>
                  }
                />
              ) : (
                <>
                  <SubmissionList
                    leagueId={leagueId}
                    items={pool.items}
                    canEdit={canEdit}
                    queuedIds={queuedIds}
                  />
                  <Pagination
                    basePath={basePath}
                    page={pool.page}
                    pageCount={pool.pageCount}
                    params={poolQueryToParams(query)}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
