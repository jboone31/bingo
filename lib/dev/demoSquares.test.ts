import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importCsv } from "@/lib/pool/importCsv";
import { parseText } from "@/lib/pool/fields";
import {
  DEMO_SQUARES_FILE,
  demoSquares,
  parseDemoSquares,
} from "./demoSquares";
import { seedPoolRows } from "./scenarios";

describe("demo squares", () => {
  it("the file imports cleanly through the pool's CSV import", () => {
    const result = importCsv(readFileSync(DEMO_SQUARES_FILE, "utf8"));
    expect(result.ok).toBe(true);
    expect(demoSquares()).toHaveLength(75);
    expect(demoSquares()[0]).toEqual({
      text: "The group collectively reads over 100 books",
      submitter: "Genevieve Frenchname",
      category: "Challenge",
    });
  });

  it("keeps quoted commas and quotes", () => {
    const texts = demoSquares().map((s) => s.text);
    expect(texts).toContain(
      'The "Jet Lag the Game" channel goes to Europe for a season under 1.5 times',
    );
    expect(texts).toContain("Michelle, Will, and Haden finish their PhDs");
  });

  it("refuses an invalid file", () => {
    expect(() => parseDemoSquares("Square,Submitter\nx,y\n")).toThrow(
      /demo squares are invalid/,
    );
  });

  it("fills a 300-square pool with distinct readable text, plus the planned duplicates", () => {
    const rows = seedPoolRows(300, demoSquares());
    expect(rows).toHaveLength(300);
    expect(rows[0].text).toBe("The group collectively reads over 100 books");
    // The second pass through the list is marked.
    expect(rows.some((r) => r.text.endsWith(" (2)"))).toBe(true);
    expect(rows.some((r) => r.text.endsWith(" (4)"))).toBe(true);
    // Every 20th row repeats the previous one exactly: 15 duplicates in 300.
    expect(rows.length - new Set(rows.map((r) => r.text)).size).toBe(15);
    for (const row of rows) expect(parseText(row.text).ok).toBe(true);
  });
});
