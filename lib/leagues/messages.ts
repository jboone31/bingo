/** Player-facing text for the `reason` values the league routes return. */
const MESSAGES: Record<string, string> = {
  invalid_name: "Enter a name of 1 to 60 characters.",
  invalid_draft_at: "Enter a valid date and time, or leave it empty.",
  invalid_code: "That code is not valid. Check it and try again.",
  invalid_body: "Something was wrong with that request.",
  league_not_found: "We could not find that league.",
  league_not_pre_draft: "That league's draft has already started.",
  league_full: "That league is full.",
  not_admin: "Only the league admin can do that.",
  admin_cannot_leave:
    "The admin cannot leave. Transfer admin or delete the league.",
  cannot_remove_self:
    "You cannot remove yourself. Use Leave or Transfer admin.",
  target_not_member: "That person is not in the league.",
  confirmation_mismatch: "The name you typed does not match.",
  unauthenticated: "Please sign in again.",
  invalid_text: "Enter the square's text, 1 to 200 characters.",
  invalid_submitter: "The submitter can be up to 60 characters.",
  invalid_category: "The category can be up to 40 characters.",
  pool_full: "The pool is limited to 5,000 squares.",
  csv_too_large: "That file is too large. The limit is 1 MB.",
  csv_empty: "That file has no rows to import.",
  csv_malformed:
    "That file is not valid CSV. Check for a missing closing quote.",
  csv_invalid: "Some rows have problems. Nothing was imported.",
  submission_not_found: "That square no longer exists.",
};

const FALLBACK = "Something went wrong. Please try again.";

/** Text for a route failure reason. Unknown reasons get a generic message. */
export function reasonMessage(reason: unknown): string {
  return typeof reason === "string" && reason in MESSAGES
    ? MESSAGES[reason]
    : FALLBACK;
}

const CSV_REASONS: Record<string, string> = {
  invalid_text: "text must be 1 to 200 characters",
  invalid_submitter: "submitter must be 60 characters or fewer",
  invalid_category: "category must be 40 characters or fewer",
  unknown_column: "unknown column name",
  duplicate_column: "this column appears more than once",
  missing_text_column: "a text column is required",
  extra_cells: "has more cells than the header",
  unterminated_quote: "a quoted value is missing its closing quote",
};

/** Text for one CSV problem, for example `Row 4, text: text must be 1 to 200 ...`. */
export function csvErrorMessage(error: {
  row: number;
  column: string;
  reason: string;
}): string {
  const where = error.column
    ? `Row ${error.row}, ${error.column}`
    : `Row ${error.row}`;
  return `${where}: ${CSV_REASONS[error.reason] ?? "problem with this row"}`;
}
