import "server-only";
import type { QueryRunner } from "@/lib/db/server";
import type { ParsedRow } from "./importCsv";

/** All SQL for the pool. Callers hold the league lock and have checked the rules. */

export interface ImportRecord {
  readonly importId: string;
  /** True when this request id was already recorded: the work was done before. */
  readonly existing: boolean;
  readonly rowCount: number;
}

/**
 * Record an add or upload by request id. A repeat returns the earlier record, so the
 * caller can skip the insert.
 */
export async function recordImport(
  tx: QueryRunner,
  leagueId: string,
  requestId: string,
  rowCount: number,
): Promise<ImportRecord> {
  const created = await tx.query(
    `insert into public.submission_imports (league_id, request_id, row_count)
     values ($1, $2, $3)
     on conflict (league_id, request_id) do nothing
     returning id`,
    [leagueId, requestId, rowCount],
  );
  if (created.rows[0]) {
    return { importId: String(created.rows[0].id), existing: false, rowCount };
  }
  const { rows } = await tx.query(
    `select id, row_count from public.submission_imports
      where league_id = $1 and request_id = $2`,
    [leagueId, requestId],
  );
  return {
    importId: String(rows[0].id),
    existing: true,
    rowCount: Number(rows[0].row_count),
  };
}

/** Insert rows in array order (so `seq` follows file order) in one statement. */
export async function insertSubmissions(
  tx: QueryRunner,
  leagueId: string,
  importId: string,
  rows: readonly ParsedRow[],
): Promise<string[]> {
  if (rows.length === 0) return [];
  const { rows: inserted } = await tx.query(
    `insert into public.submissions (league_id, import_id, text, submitter, category)
     select $1, $2, t.text, t.submitter, t.category
       from unnest($3::text[], $4::text[], $5::text[]) with ordinality
            as t(text, submitter, category, n)
      order by t.n
     returning id`,
    [
      leagueId,
      importId,
      rows.map((r) => r.text),
      rows.map((r) => r.submitter),
      rows.map((r) => r.category),
    ],
  );
  return inserted.map((r) => String(r.id));
}

export async function countSubmissions(
  tx: QueryRunner,
  leagueId: string,
): Promise<number> {
  const { rows } = await tx.query(
    `select count(*)::int as n from public.submissions where league_id = $1`,
    [leagueId],
  );
  return Number(rows[0].n);
}

/** The first submission created by an import, or `null` if it was deleted since. */
export async function firstSubmissionOfImport(
  tx: QueryRunner,
  importId: string,
): Promise<string | null> {
  const { rows } = await tx.query(
    `select id from public.submissions where import_id = $1 order by seq limit 1`,
    [importId],
  );
  return rows[0] ? String(rows[0].id) : null;
}

export interface SubmissionPatch {
  text?: string;
  submitter?: string;
  category?: string;
}

/** What {@link updateSubmission} found. */
export type UpdateOutcome = "updated" | "unchanged" | "missing";

/**
 * Update the given fields of one submission in this league. Column names come from a
 * fixed list, never from the request. Says whether the row was missing, already held
 * these values, or was changed.
 */
export async function updateSubmission(
  tx: QueryRunner,
  leagueId: string,
  id: string,
  patch: SubmissionPatch,
): Promise<UpdateOutcome> {
  const columns = (["text", "submitter", "category"] as const).filter(
    (c) => patch[c] !== undefined,
  );
  if (columns.length === 0) return "unchanged";
  const values = columns.map((c) => patch[c]);
  const assignments = columns.map((c, i) => `${c} = $${i + 3}`).join(", ");
  const differs = columns
    .map((c, i) => `${c} is distinct from $${i + 3}`)
    .join(" or ");
  const { rows } = await tx.query(
    `with found as (
       select id from public.submissions where id = $1 and league_id = $2
     ), changed as (
       update public.submissions set ${assignments}
        where id = $1 and league_id = $2 and (${differs})
        returning id
     )
     select (select count(*) from found)::int as found,
            (select count(*) from changed)::int as changed`,
    [id, leagueId, ...values],
  );
  if (Number(rows[0].found) === 0) return "missing";
  return Number(rows[0].changed) > 0 ? "updated" : "unchanged";
}

/** Delete one submission. Returns whether a row was deleted. */
export async function deleteSubmission(
  tx: QueryRunner,
  leagueId: string,
  id: string,
): Promise<boolean> {
  const { rows } = await tx.query(
    `delete from public.submissions where id = $1 and league_id = $2
      returning id`,
    [id, leagueId],
  );
  return rows.length > 0;
}

export async function deleteAllSubmissions(
  tx: QueryRunner,
  leagueId: string,
): Promise<number> {
  const { rows } = await tx.query(
    `delete from public.submissions where league_id = $1 returning id`,
    [leagueId],
  );
  return rows.length;
}
