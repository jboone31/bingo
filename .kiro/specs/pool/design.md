# F3: Pool Administration. Design

## Overview

A `submissions` table per league, a small `submission_imports` table for repeat
safety, pure CSV and validation code in `lib/pool/`, server routes that follow the F2
pattern (lock the league row, check role and status, write), and a pool page with
admin tools.

## Data Model

Migration `0006_submissions.sql`:

```sql
begin;

create table public.submission_imports (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  request_id uuid not null,
  row_count integer not null check (row_count >= 0),
  created_at timestamptz not null default now(),
  unique (league_id, request_id)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,
  league_id uuid not null references public.leagues (id) on delete cascade,
  import_id uuid references public.submission_imports (id) on delete set null,
  text text not null
    check (text = btrim(text) and char_length(text) between 1 and 200),
  submitter text not null default ''
    check (submitter = btrim(submitter) and char_length(submitter) <= 60),
  category text not null default ''
    check (category = btrim(category) and char_length(category) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index submissions_league_seq_idx on public.submissions (league_id, seq);
```

Notes:

- `id` is the unique row id. Nothing is unique on `text`, so duplicates are allowed.
  Later features (queues, picks) reference `submissions.id` and must not assume
  distinct text.
- `seq` gives a stable "order added" that survives edits and ties inside one insert.
- `submission_imports` records each add or upload. Its unique `(league_id,
request_id)` is what makes a repeat harmless. A single add is an import of one row.
- Tables that reference a league cascade on delete, as `conventions.md` requires.
  `submission_imports` rows go with the league.
- `import_id ... on delete set null` lets the import record be removed later without
  losing rows.

Triggers (all `security definer`, `search_path = ''`, execute revoked from
`public`, `anon`, `authenticated`):

- `submissions_guard` (before insert, update, delete, per row): look up the league's
  status. If the league row is missing (it is being deleted and this is the cascade),
  allow. Otherwise raise `league_not_pre_draft` unless the status is `pre_draft`.
  On update, also refuse a change of `league_id` or `id`.
- `submissions_touch` (before update): set `updated_at`.
- `submissions_cap` (after insert, **statement level**, with a transition table): raise
  `pool_full` if any league in the inserted rows now has more than 5,000 submissions.
  One count per statement keeps a 5,000-row import cheap.

RLS and grants:

```sql
alter table public.submissions enable row level security;
alter table public.submission_imports enable row level security;

create policy submissions_select_member on public.submissions
  for select to authenticated using (public.is_league_member(league_id));

revoke all on public.submissions, public.submission_imports from anon, authenticated;
grant select on public.submissions to authenticated;
```

`submission_imports` has RLS enabled and no policy, so only the server role reads it.
The `league_id` index is the leading column of `submissions_league_seq_idx`.

No Realtime publication in F3. F4 and F8 add it when they subscribe.

## Pure Logic (`lib/pool/`)

- `limits.ts`: `TEXT_MAX = 200`, `SUBMITTER_MAX = 60`, `CATEGORY_MAX = 40`,
  `MAX_SUBMISSIONS = 5000`, `MAX_CSV_BYTES = 1_000_000`, `PAGE_SIZE = 50`.
- `fields.ts`: `parseText`, `parseSubmitter`, `parseCategory`. Each trims, counts code
  points, rejects control characters, and for category collapses runs of whitespace.
  Return `{ ok: true, value } | { ok: false, reason }` with reasons `invalid_text`,
  `invalid_submitter`, `invalid_category`. Blank submitter and category are valid
  (`""`). `displaySubmitter("")` is `"Unknown"` and `displayCategory("")` is
  `"Uncategorized"`.
- `csv.ts`: `parseCsv(text): { rows: string[][] } | { error: "unterminated_quote" }`
  (strips a BOM, handles quotes, escaped quotes, CRLF, LF, quoted line breaks, and
  drops fully blank lines) and `serializeCsv(rows: string[][]): string` (quotes fields
  that contain commas, quotes or line breaks). Used by the template and by F11.
- `importCsv.ts`: `importCsv(text)` returns
  `{ ok: true, rows: ParsedRow[] }` or
  `{ ok: false, reason: "csv_empty" | "csv_invalid" | "csv_malformed", errors, totalErrors }`.
  - Maps the header (case-insensitive, trimmed) to `text`, `submitter`, `category`.
    Accepted names for the text column: `text`, `submission`, `submission text`.
    Missing text column: one error at row 1. Unknown column: one error per unknown
    column at row 1. Duplicate columns: an error.
  - Validates each data row with the field parsers. Rows with extra or missing cells
    count missing cells as empty and extra cells as an error.
  - `errors` is capped at 50 entries; `totalErrors` is the full count. Each error is
    `{ row, column, reason }` with `row` counting the header as 1.
- `rules.ts`: decisions over plain data, as in F2:
  - `canEditPool({ status, actorRole })` returns `not_admin` (403) or
    `league_not_pre_draft` (409).
  - `canAddSubmissions({ status, actorRole, currentCount, adding })` adds `pool_full`
    (409) when `currentCount + adding > MAX_SUBMISSIONS`.

## Server Data Access (`lib/pool/queries.ts`, server-only)

- `recordImport(tx, leagueId, requestId, rowCount)`: `insert into submission_imports
... on conflict (league_id, request_id) do nothing returning id`. When nothing is
  returned, it reads and returns the existing import with `{ existing: true,
rowCount }`.
- `insertSubmissions(tx, leagueId, importId, rows)`: one statement using
  `unnest($3::text[], $4::text[], $5::text[])` so a 5,000-row import is one round
  trip, preserving array order for `seq`.
- `countSubmissions(tx, leagueId)`, `updateSubmission(tx, leagueId, id, fields)`
  (`where id = $ and league_id = $`, returns the row or `null`),
  `deleteSubmission(tx, leagueId, id)`, `deleteAllSubmissions(tx, leagueId)` returns
  the count.

The import flow inside one transaction: lock league, check role and status, call
`recordImport` first; if it was an existing import, return its count with
`alreadyImported`; otherwise check the cap with `canAddSubmissions`, insert, and update
the import's `row_count`. A failure rolls everything back, including the import record,
so a retry after a failure can succeed.

## Routes

Under `app/api/leagues/[leagueId]/submissions/`, Node.js runtime, built on `handle`.

| Method and path                       | Body                                          | Result |
| ------------------------------------- | --------------------------------------------- | ------ |
| `POST .../submissions`                | `{ text, submitter?, category?, requestId }`  | `201 { ok, submission: { id } }`, repeat `200` |
| `POST .../submissions/import`         | `{ csv, requestId, dryRun? }`                 | dry run `200 { ok, rowCount, preview }`; import `201 { ok, imported }`, repeat `200 { ok, imported, alreadyImported: true }` |
| `PATCH .../submissions/[submissionId]`| any of `{ text, submitter, category }`, at least one | `200 { ok }` |
| `DELETE .../submissions/[submissionId]` | none                                        | `200 { ok }` |
| `DELETE .../submissions`              | `{ all: true }`                               | `200 { ok, deleted }` |

Order of work in each: validate input (ids are UUIDs, unknown keys rejected, CSV size
checked before parsing), authenticate, then one transaction: lock league, load role,
rules, write.

Failure for a bad CSV is `422 { ok: false, reason: "csv_invalid", errors, totalErrors }`
(and `csv_malformed`, `csv_empty` the same way). It is the one failure with extra
fields; they are plain data about the file, never database text.

New reasons: `invalid_text`, `invalid_submitter`, `invalid_category` (400),
`csv_too_large` (413), `csv_invalid`, `csv_malformed`, `csv_empty` (422),
`pool_full` (409), `submission_not_found` (404, edit of a row that does not exist).
The existing `league_not_found`, `not_admin` and `league_not_pre_draft` apply.

Repeat safety: add and import by request id; edit sets the same values; delete of a
missing row and clear of an empty pool succeed.

## Pages And Components

```
app/(app)/leagues/[leagueId]/pool/page.tsx   pool page (all members; admin tools for admin)
```

`?page=N` is read from search params, clamped to the valid range. Reads use the RLS
client in `lib/pool/read.ts` (`listSubmissions(leagueId, page)` using
`range(from, to)` with `count: "exact"`, ordered by `seq`).

`components/pool/`:

| Component              | Notes                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| `SubmissionList`       | Server component. Cards: text, "by Submitter", category badge. A card list rather than a table, so it works at phone width. Admin rows include `SubmissionActions`. |
| `SubmissionActions`    | Client. Edit opens a `Dialog` with three `TextField`s; Delete uses `ConfirmAction`. |
| `AddSubmissionForm`    | Client. Text, submitter, category; creates a request id per attempt and renews it after success. |
| `ImportCsvPanel`       | Client. File input (`accept=".csv,text/csv"`), reads the text, calls the route with `dryRun`, shows count, first five rows and errors, then an Import button that sends the same text with the same request id. Download-template link. Clear selection to start over. |
| `ClearPoolButton`      | Client. `ConfirmAction` on `DELETE .../submissions`.                     |
| `ui/Pagination`        | Server-friendly links for previous and next with "Page X of Y". Shared with F4. |

Admin tools show only when the viewer is admin and the league is `pre_draft`. The
League layout adds a Pool item to `SubNav` for everyone. The overview Details panel
shows the pool size (count query through RLS).

`lib/pool/messages.ts` maps reasons to player-facing text, extending the F2 message
helper (one `reasonMessage` that knows both sets).

## Dev Scenarios

`ScenarioPlan` gains `poolSubmissions: number` (default 0, so existing scenarios do
not change). `seedScenario` inserts that many generated submissions after the members,
in one statement: text `Seed square NNN` (with three exact duplicates in
`league_with_pool`), submitters cycling through five names, categories cycling through
five names, plus a few blanks.

| Scenario           | Plan                                                       |
| ------------------ | ---------------------------------------------------------- |
| `league_with_pool` | admin, 11 players, 60 submissions, draft date +7 days      |
| `pool_ready`       | admin, 11 players, 300 submissions, draft date +7 days     |

## Testing

Offline:

- `csv`: property that `parseCsv(serializeCsv(rows))` returns the same rows for any
  rows of strings (including commas, quotes, CR and LF inside fields) except fully
  empty rows; examples for BOM, CRLF, blank lines, unterminated quote.
- `importCsv`: examples for each header alias and order, unknown and duplicate
  columns, missing text column, empty file, row errors with correct row numbers,
  the 50-error cap with the true total, and extra cells. Property: every accepted row
  satisfies the field rules.
- `fields`: examples and properties like the F1 and F2 name parsers (length by code
  points, trimmed, no control characters, whitespace collapse for category).
- `rules`: tables and properties (only admin and pre_draft pass; the cap boundary at
  exactly 5,000).
- Route tests (session and queries mocked): bad input, 401, not-found for non-members,
  403, 409 after the draft starts, success, repeat requests, dry run writes nothing,
  invalid CSV returns row errors and writes nothing, `pool_full`, `csv_too_large`, no
  raw error text.
- Component tests for `AddSubmissionForm`, `ImportCsvPanel` (preview, errors, confirm
  sends the same request id), `SubmissionActions`, `Pagination`.
- Page smoke test for the pool page (admin and member views, empty state).

Integration (`test/integration/pool.integration.test.ts`):

- Members read the pool; non-members and anon do not; no direct writes.
- Duplicate text is accepted and gets distinct ids.
- The guard trigger rejects insert, update and delete once the league is `drafting`,
  and allows cascade deletion of a league.
- The cap trigger rejects an insert that takes a league past 5,000 (using
  `generate_series`) and accepts exactly 5,000.
- Check constraints reject over-long and untrimmed values.
- `(league_id, request_id)` cannot be recorded twice.
- The query functions: bulk insert keeps order in `seq`, update only touches the
  league's own row, delete all returns the count.
- The two new seed scenarios build the planned pool size (run with the F2.5 suite,
  since it uses the service-role key).

## Structure And Convention Updates

- `structure.md`: `lib/pool/`, `components/pool/`, the new routes and page.
- `draft-rules.md`: duplicates allowed, unique row ids, uploads append and are all or
  nothing.
- `roadmap.md`: record the decisions, mark F3 Done when shipped.
- `conventions.md`: add to Database: "A row that other tables point at (a submission)
  is referenced by its `id`. Never rely on text being unique."
