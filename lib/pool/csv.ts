/**
 * Minimal RFC 4180 CSV. Pure and framework-free, shared by import and (later)
 * export.
 */
export interface CsvRecord {
  /** The cells of this row. */
  readonly fields: string[];
  /** 1-based record number, counting blank lines, so it matches a spreadsheet row. */
  readonly row: number;
}

export type ParsedCsv =
  | { ok: true; records: CsvRecord[] }
  | { ok: false; error: "unterminated_quote" };

/**
 * Parse CSV text. Handles a leading byte-order mark, quoted fields (commas, quotes
 * as `""`, and line breaks inside quotes), and CRLF, LF or CR row ends. Blank lines
 * are skipped but still counted in `row`.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: CsvRecord[] = [];
  let fields: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldWasQuoted = false;
  let rowQuoted = false;
  let recordNumber = 0;

  const endField = () => {
    fields.push(field);
    field = "";
    fieldWasQuoted = false;
  };
  const endRecord = () => {
    endField();
    recordNumber += 1;
    const blank = fields.length === 1 && fields[0] === "" && !rowQuoted;
    if (!blank) {
      records.push({ fields, row: recordNumber });
    }
    fields = [];
    rowQuoted = false;
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "" && !fieldWasQuoted) {
      inQuotes = true;
      fieldWasQuoted = true;
      rowQuoted = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      endRecord();
    } else {
      field += ch;
    }
  }
  if (inQuotes) {
    return { ok: false, error: "unterminated_quote" };
  }
  if (field !== "" || fields.length > 0 || fieldWasQuoted) {
    endRecord();
  }
  return { ok: true, records };
}

/** Quote a cell when it holds a comma, quote, or line break. */
function quoteCell(cell: string): string {
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

/**
 * Serialize rows to CSV with LF row ends. A row holding only an empty cell is
 * written as `""` so it is not mistaken for a blank line.
 */
export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return rows
    .filter((row) => row.length > 0)
    .map((row) =>
      row.length === 1 && row[0] === "" ? '""' : row.map(quoteCell).join(","),
    )
    .join("\n");
}
