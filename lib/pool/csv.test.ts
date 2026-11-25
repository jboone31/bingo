import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseCsv, serializeCsv } from "./csv";

const cells = (text: string) => {
  const result = parseCsv(text);
  if (!result.ok) throw new Error(result.error);
  return result.records.map((r) => r.fields);
};

describe("parseCsv", () => {
  it("parses simple rows with LF, CRLF and CR", () => {
    expect(cells("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(cells("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(cells("a,b\r1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles quoted commas, quotes and line breaks", () => {
    expect(cells('"a,b","say ""hi""","x\ny"')).toEqual([
      ["a,b", 'say "hi"', "x\ny"],
    ]);
  });

  it("strips a byte-order mark and keeps empty cells", () => {
    expect(cells("\ufeffa,,c")).toEqual([["a", "", "c"]]);
    expect(cells("a,b,")).toEqual([["a", "b", ""]]);
  });

  it("skips blank lines but counts them in row numbers", () => {
    const result = parseCsv("a\n\n\nb");
    expect(result).toEqual({
      ok: true,
      records: [
        { fields: ["a"], row: 1 },
        { fields: ["b"], row: 4 },
      ],
    });
  });

  it("keeps a quoted empty cell as a row", () => {
    expect(cells('""')).toEqual([[""]]);
  });

  it("reports an unterminated quote", () => {
    expect(parseCsv('a,"b')).toEqual({
      ok: false,
      error: "unterminated_quote",
    });
  });

  it("returns no records for empty input", () => {
    expect(cells("")).toEqual([]);
  });
});

describe("serializeCsv", () => {
  it("round-trips any rows, including commas, quotes and line breaks", () => {
    const row = fc.array(fc.string({ unit: "binary" }), {
      minLength: 1,
      maxLength: 5,
    });
    fc.assert(
      fc.property(fc.array(row, { minLength: 1, maxLength: 8 }), (rows) => {
        expect(cells(serializeCsv(rows))).toEqual(rows);
      }),
      { numRuns: 300 },
    );
  });

  it("quotes only when needed", () => {
    expect(serializeCsv([["a", "b,c", 'd"e']])).toBe('a,"b,c","d""e"');
  });
});
