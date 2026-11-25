import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const css = readFileSync(join(ROOT, "app", "tokens.css"), "utf8");

type Palette = Record<string, string>;

/** Read `--color-*: #hex;` declarations from one CSS block body. */
function colors(block: string): Palette {
  const out: Palette = {};
  for (const m of block.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim();
  }
  return out;
}

function blockAfter(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

const dark = colors(blockAfter(':root,\n[data-theme="dark"]'));
const light = colors(blockAfter(':root:not([data-theme="dark"])'));

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** [foreground, background, minimum ratio] */
const PAIRS: [string, string, number][] = [
  ["--color-text", "--color-bg", 4.5],
  ["--color-text", "--color-surface", 4.5],
  ["--color-text", "--color-raised", 4.5],
  ["--color-muted", "--color-bg", 4.5],
  ["--color-muted", "--color-surface", 4.5],
  ["--color-muted", "--color-raised", 4.5],
  ["--color-on-accent", "--color-accent", 4.5],
  ["--color-accent-ink", "--color-bg", 4.5],
  ["--color-accent-ink", "--color-surface", 4.5],
  ["--color-info", "--color-surface", 4.5],
  ["--color-danger", "--color-surface", 4.5],
  ["--color-success", "--color-surface", 4.5],
  ["--color-border", "--color-bg", 3],
  ["--color-border", "--color-surface", 3],
];

describe.each([
  ["dark", dark],
  ["light", light],
])("%s palette", (_name, palette) => {
  it("defines every color token as 6-digit hex", () => {
    expect(Object.keys(palette).length).toBeGreaterThan(0);
    for (const [token, value] of Object.entries(palette)) {
      expect(value, token).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(PAIRS)("%s on %s is at least %s:1", (fg, bg, min) => {
    expect(
      contrast(palette[fg], palette[bg]),
      `${fg} on ${bg}`,
    ).toBeGreaterThanOrEqual(min);
  });
});

it("light and dark define the same tokens", () => {
  expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
});

/** All `.module.css` files under components/ and app/. */
function moduleCss(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...moduleCss(path));
    } else if (entry.endsWith(".module.css")) {
      found.push(path);
    }
  }
  return found;
}

describe("component styles use tokens only", () => {
  const files = [
    ...moduleCss(join(ROOT, "components")),
    ...moduleCss(join(ROOT, "app")),
  ];

  it("finds component stylesheets", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("contains no hard-coded colors or font families", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text, file).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/);
      expect(text, file).not.toMatch(/font-family\s*:(?!\s*var\()/);
    }
  });
});
