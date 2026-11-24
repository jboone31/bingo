import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** Root directories that are tooling, build output, or version control. */
const NOT_SOURCE = new Set([
  ".git",
  ".next",
  ".vercel",
  "node_modules",
  "coverage",
]);

/** Directory names listed in the Top-Level Layout block of structure.md. */
function documentedDirectories(): string[] {
  const text = readFileSync(
    join(ROOT, ".kiro", "steering", "structure.md"),
    "utf8",
  );
  const section = text.split("## Top-Level Layout")[1] ?? "";
  const block = /```\n([\s\S]*?)```/.exec(section)?.[1] ?? "";
  return block
    .split("\n")
    .map((line) => /^ {2}(\.?[\w-]+)\//.exec(line)?.[1])
    .filter((name): name is string => name !== undefined);
}

describe("structure.md consistency", () => {
  const documented = documentedDirectories();

  it("documents at least the core directories", () => {
    expect(documented).toEqual(
      expect.arrayContaining(["app", "lib", "supabase", "scripts", "test"]),
    );
  });

  it("names only directories that exist", () => {
    for (const name of documented) {
      expect(existsSync(join(ROOT, name)), `${name}/ is missing`).toBe(true);
    }
  });

  it("lists every top-level source directory", () => {
    const actual = readdirSync(ROOT, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => !NOT_SOURCE.has(name));
    for (const name of actual) {
      expect(documented, `${name}/ is not in structure.md`).toContain(name);
    }
  });
});
