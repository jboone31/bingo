import { parseCsv } from "./csv";
import { parseCategory, parseSubmitter, parseText } from "./fields";
import { MAX_REPORTED_ERRORS } from "./limits";

export interface ParsedRow {
  readonly text: string;
  readonly submitter: string;
  readonly category: string;
}

export interface CsvError {
  /** Spreadsheet row number; the header is row 1. */
  readonly row: number;
  /** The column the problem is in, or an empty string for the whole row. */
  readonly column: string;
  readonly reason: string;
}

export type ImportResult =
  | { ok: true; rows: ParsedRow[] }
  | {
      ok: false;
      reason: "csv_empty" | "csv_invalid" | "csv_malformed";
      errors: CsvError[];
      totalErrors: number;
    };

type Column = "text" | "submitter" | "category";

const TEXT_ALIASES = ["text", "submission", "submission text"];

function columnFor(header: string): Column | null {
  const name = header.trim().toLowerCase();
  if (TEXT_ALIASES.includes(name)) return "text";
  if (name === "submitter") return "submitter";
  if (name === "category") return "category";
  return null;
}

function failure(
  reason: "csv_empty" | "csv_invalid" | "csv_malformed",
  errors: CsvError[],
): ImportResult {
  return {
    ok: false,
    reason,
    errors: errors.slice(0, MAX_REPORTED_ERRORS),
    totalErrors: errors.length,
  };
}

/**
 * Validate a whole CSV for import. All or nothing: any problem yields errors and no
 * rows. The first row is a header; columns may be in any order.
 */
export function importCsv(text: string): ImportResult {
  const parsed = parseCsv(text);
  if (!parsed.ok) {
    return failure("csv_malformed", [
      { row: 1, column: "", reason: parsed.error },
    ]);
  }
  const [header, ...data] = parsed.records;
  if (header === undefined || data.length === 0) {
    return failure("csv_empty", []);
  }

  const errors: CsvError[] = [];
  const columns: (Column | null)[] = [];
  const seen = new Set<Column>();
  header.fields.forEach((name) => {
    const column = columnFor(name);
    if (column === null) {
      errors.push({
        row: header.row,
        column: name.trim(),
        reason: "unknown_column",
      });
    } else if (seen.has(column)) {
      errors.push({
        row: header.row,
        column: name.trim(),
        reason: "duplicate_column",
      });
    } else {
      seen.add(column);
    }
    columns.push(column);
  });
  if (!seen.has("text")) {
    errors.push({
      row: header.row,
      column: "text",
      reason: "missing_text_column",
    });
  }
  if (errors.length > 0) {
    return failure("csv_invalid", errors);
  }

  const rows: ParsedRow[] = [];
  for (const record of data) {
    const cell: Record<Column, string> = {
      text: "",
      submitter: "",
      category: "",
    };
    record.fields.forEach((value, index) => {
      const column = columns[index];
      if (column === undefined) {
        if (value.trim() !== "") {
          errors.push({ row: record.row, column: "", reason: "extra_cells" });
        }
      } else if (column !== null) {
        cell[column] = value;
      }
    });
    const t = parseText(cell.text);
    const s = parseSubmitter(cell.submitter);
    const c = parseCategory(cell.category);
    if (!t.ok)
      errors.push({ row: record.row, column: "text", reason: t.reason });
    if (!s.ok)
      errors.push({ row: record.row, column: "submitter", reason: s.reason });
    if (!c.ok)
      errors.push({ row: record.row, column: "category", reason: c.reason });
    if (t.ok && s.ok && c.ok) {
      rows.push({ text: t.value, submitter: s.value, category: c.value });
    }
  }
  if (errors.length > 0) {
    return failure("csv_invalid", errors);
  }
  return { ok: true, rows };
}

/** The template admins can download. */
export const CSV_TEMPLATE =
  "text,submitter,category\nTeam X wins the title,Sam,Sports\n";
