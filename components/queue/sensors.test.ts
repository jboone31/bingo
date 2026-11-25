import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AUTO_SCROLL, MOUSE_ACTIVATION, TOUCH_ACTIVATION } from "./sensors";

describe("queue drag configuration", () => {
  it("touch needs a short press and tolerates a little finger wobble", () => {
    // Long enough that a swipe has already started scrolling, short enough to feel quick.
    expect(TOUCH_ACTIVATION.delay).toBeGreaterThanOrEqual(150);
    expect(TOUCH_ACTIVATION.delay).toBeLessThanOrEqual(400);
    expect(TOUCH_ACTIVATION.tolerance).toBeGreaterThan(0);
    expect(TOUCH_ACTIVATION.tolerance).toBeLessThanOrEqual(16);
  });

  it("mouse starts after a few pixels, not on a plain click", () => {
    expect(MOUSE_ACTIVATION.distance).toBeGreaterThan(0);
  });

  it("scrolls the page near the top and bottom edges", () => {
    expect(AUTO_SCROLL.acceleration).toBeGreaterThan(0);
    expect(AUTO_SCROLL.threshold.y).toBeGreaterThan(0);
    expect(AUTO_SCROLL.threshold.y).toBeLessThan(0.5);
  });
});

describe("queue styles keep the page scrollable on touch screens", () => {
  const css = readFileSync(
    join(process.cwd(), "components", "queue", "QueueList.module.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  it("never sets touch-action: none, which would block scrolling from the handle", () => {
    expect(css).not.toMatch(/touch-action\s*:\s*none/);
  });

  it("stops a long press from selecting text or opening the browser menu", () => {
    expect(css).toMatch(/-webkit-touch-callout\s*:\s*none/);
    expect(css).toMatch(/user-select\s*:\s*none/);
  });
});
