# F3: Pool Administration. Requirements

Depends on F2 (and F2.5 for dev scenarios). Rules referenced: `draft-rules.md`
(Submission Pool), `conventions.md`, `product.md`.

## Decisions Recorded

- **Duplicates are allowed.** Every submission has its own unique row id, so two rows
  with identical text are distinct squares. It is the admin's job to clean up input,
  and editing and deleting single rows is how they do it.
- **A CSV upload adds to the pool.** Re-uploading never replaces what is there.
- **Uploads are all or nothing.** If any row is invalid, nothing is imported and the
  admin gets a list of the bad rows to fix. Because uploads append, importing the
  good rows and skipping the bad ones would create duplicates when the fixed file is
  uploaded again.
- **Uploads and single adds are safe to repeat.** Each carries a request id, so a
  double click or a retry does not add the rows twice, even though duplicates are
  otherwise allowed.
- **Fields.** Text is required (1 to 200 characters). Submitter (up to 60) and
  category (up to 40) are optional. A blank submitter shows as "Unknown" and a blank
  category as "Uncategorized". Category is free text, trimmed, with repeated spaces
  collapsed; its capitalization is kept as typed.
- **Limits.** 5,000 submissions per league and 1 MB per uploaded file, enforced on
  the server and, for the count, in the database.
- **Only the admin edits the pool, and only while `pre_draft`.** The database refuses
  changes after the draft starts.
- **Submitter names are always visible** to every member (decided earlier).
- **Clear pool** (delete every submission) is included, so a mistaken upload can be
  undone without deleting rows one by one.
- Draft date editing was already built in F2. It is not part of F3.

## User Stories And Acceptance Criteria

### R1. Add one submission

1. The admin can add a submission from the pool page with text, submitter and
   category.
2. Text is trimmed and must be 1 to 200 characters with no control characters.
   Submitter and category are trimmed and may be empty, within their limits. Bad
   values are rejected with `invalid_text`, `invalid_submitter` or
   `invalid_category`.
3. The form sends a request id. Repeating the same request does not add a second row.
4. The new row appears in the pool list. It gets a unique id.

### R2. Upload a CSV

1. The admin can choose a CSV file on the pool page. The file is read in the browser
   and sent to the server as text, with a request id.
2. The first row is a header. A `text` column is required (`text`, `submission`, or
   `submission text`, any capitalization). `submitter` and `category` columns are
   optional. Columns may be in any order. Any other column name is an error.
3. The parser follows standard CSV: quoted fields, commas and line breaks inside
   quotes, `""` for a quote, CRLF or LF, and an optional byte-order mark. Blank lines
   are ignored.
4. Every row is checked with the same rules as R1. The response lists every problem
   with its row number (counting the header as row 1), the column, and a reason,
   showing the first 50 and the total count.
5. If any row is invalid, nothing is imported.
6. A **preview** step runs the same checks without saving and shows the row count, the
   first five rows, and any errors. The admin then confirms the import.
7. A file that would take the pool over 5,000 is refused with `pool_full`. A file over
   1 MB is refused with `csv_too_large`.
8. Importing the same request id again returns the earlier result and adds nothing.
9. An upload with a header but no data rows is refused with `csv_empty`.
10. The page offers a downloadable template with the header and one example row.

### R3. Edit and delete rows

1. The admin can edit any field of a single submission, and the change applies to
   that row only.
2. The admin can delete a single submission. Deleting a row that is already gone
   succeeds without change.
3. The admin can clear the whole pool after confirming. Clearing an empty pool
   succeeds.
4. All of these are refused with `league_not_pre_draft` once the draft has started.

### R4. View the pool

1. Every member can open `/leagues/[leagueId]/pool` and see the submissions: text,
   submitter, category.
2. The list is paged at 50 per page, in the order the rows were added, with a total
   count. The page number is in the URL (`?page=2`).
3. Admin controls (add, upload, edit, delete, clear) appear for the admin only, and
   only while `pre_draft`.
4. An empty pool shows an empty state. For the admin it points to the add and upload
   actions.
5. The league overview shows the pool size.
6. League navigation gains a Pool item for every member.
7. Filtering, sorting and adding to a queue arrive in F4.

### R5. Authorization and access

1. All writes go through server routes in one transaction that locks the league row,
   re-checks the caller's role and the league status, then writes.
2. Non-members get `league_not_found` for every action. Members who are not the admin
   get `not_admin`.
3. `submissions` has RLS enabled, with a select policy for league members, and no
   insert, update or delete policy. Direct writes by users fail.
4. Failures use `{ ok: false, reason }`. No raw database errors reach the client.

### R6. Dev scenarios

New seed scenarios (see Appendix): `league_with_pool` and `pool_ready`.

## Out Of Scope

- Filtering, sorting and queueing (F4).
- Players adding their own submissions.
- Undoing a single import (an `import_id` is stored, so it is easy to add later).
- Exporting the pool. When F11 exports CSV it must neutralize cells that start with
  `=`, `+`, `-` or `@`.

## Appendix: Dev Scenarios

| Scenario           | State                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| `league_with_pool` | `pre_draft`, you are admin, 11 players, 60 submissions in 5 categories, 3 exact duplicates |
| `pool_ready`       | `pre_draft`, you are admin, 11 players, 300 submissions (enough for one group of 12) |
