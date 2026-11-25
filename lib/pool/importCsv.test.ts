import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CSV_TEMPLATE, importCsv } from "./importCsv";
import { serializeCsv } from "./csv";

const rowsOf = (text: string) => {
  const r = importCsv(text);
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.rows;
};

describe("importCsv", () => {
  it("accepts the template", () => {
    expect(rowsOf(CSV_TEMPLATE)).toEqual([
      { text: "Team X wins the title", submitter: "Sam", category: "Sports" },
    ]);
  });

  it.each(["text", "Text", "SUBMISSION", " Submission Text "])(
    "accepts %j as the text column",
    (name) => {
      expect(rowsOf(`${name}\nHello`)).toEqual([
        { text: "Hello", submitter: "", category: "" },
      ]);
    },
  );

  it("accepts columns in any order and optional columns missing", () => {
    expect(rowsOf("category,text\nSports,A wins")).toEqual([
      { text: "A wins", submitter: "", category: "Sports" },
    ]);
  });

  it("keeps duplicate rows", () => {
    expect(rowsOf("text\nSame\nSame")).toHaveLength(2);
  });

  it("allows commas inside quoted text but rejects line breaks in a cell", () => {
    expect(rowsOf('text\n"Hello, world"').map((r) => r.text)).toEqual([
      "Hello, world",
    ]);
    expect(importCsv('text\n"two\nlines"')).toMatchObject({
      reason: "csv_invalid",
      errors: [{ row: 2, column: "text", reason: "invalid_text" }],
    });
  });

  it("reports an empty file and a header with no rows", () => {
    expect(importCsv("")).toMatchObject({ ok: false, reason: "csv_empty" });
    expect(importCsv("text,submitter,category\n")).toMatchObject({
      ok: false,
      reason: "csv_empty",
    });
  });

  it("reports an unterminated quote as malformed", () => {
    expect(importCsv('text\n"oops')).toMatchObject({
      ok: false,
      reason: "csv_malformed",
    });
  });

  it("reports header problems on row 1", () => {
    expect(importCsv("submitter\nSam")).toMatchObject({
      reason: "csv_invalid",
      errors: [{ row: 1, column: "text", reason: "missing_text_column" }],
    });
    expect(importCsv("text,color\nA,red")).toMatchObject({
      errors: [{ row: 1, column: "color", reason: "unknown_column" }],
    });
    expect(importCsv("text,Text\nA,B")).toMatchObject({
      errors: [{ row: 1, column: "Text", reason: "duplicate_column" }],
    });
  });

  it("reports row problems with spreadsheet row numbers, and imports nothing", () => {
    const result = importCsv(
      `text,submitter,category\nOk,Sam,A\n\n,Bob,B\n${"x".repeat(201)},Bob,B\nFine,${"s".repeat(61)},C`,
    );
    expect(result).toEqual({
      ok: false,
      reason: "csv_invalid",
      errors: [
        { row: 4, column: "text", reason: "invalid_text" },
        { row: 5, column: "text", reason: "invalid_text" },
        { row: 6, column: "submitter", reason: "invalid_submitter" },
      ],
      totalErrors: 3,
    });
  });

  it("flags extra non-empty cells but ignores trailing commas", () => {
    expect(importCsv("text\nA,B")).toMatchObject({
      errors: [{ row: 2, column: "", reason: "extra_cells" }],
    });
    expect(rowsOf("text\nA,,")).toEqual([
      { text: "A", submitter: "", category: "" },
    ]);
  });

  it("caps reported errors at 50 but counts them all", () => {
    const body = Array.from({ length: 80 }, () => ",x,y").join("\n");
    const result = importCsv(`text,submitter,category\n${body}`);
    expect(result).toMatchObject({ ok: false, totalErrors: 80 });
    expect(result.ok === false && result.errors).toHaveLength(50);
  });

  it("every accepted row satisfies the field rules", () => {
    const cell = fc.string({ unit: "binary", maxLength: 30 });
    fc.assert(
      fc.property(
        fc.array(fc.tuple(cell, cell, cell), { minLength: 1, maxLength: 10 }),
        (rows) => {
          const csv = serializeCsv([
            ["text", "submitter", "category"],
            ...rows.map((r) => [...r]),
          ]);
          const result = importCsv(csv);
          if (result.ok) {
            for (const row of result.rows) {
              expect(row.text).toBe(row.text.trim());
              expect(row.text.length).toBeGreaterThan(0);
              expect(row.category).not.toMatch(/\s{2,}/);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
