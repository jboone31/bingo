/** Draft settings limits. The database checks the same ranges. */
export const GROUP_COUNT = { min: 1, max: 10, default: 1 } as const;
export const PICK_SECONDS = { min: 10, max: 900, default: 60 } as const;

export type Parsed = { ok: true; value: number } | { ok: false };

function parseIntIn(value: unknown, min: number, max: number): Parsed {
  if (typeof value !== "number" || !Number.isInteger(value))
    return { ok: false };
  if (value < min || value > max) return { ok: false };
  return { ok: true, value };
}

/** A group count: an integer from 1 to 10. Strings and fractions are refused. */
export const parseGroupCount = (value: unknown): Parsed =>
  parseIntIn(value, GROUP_COUNT.min, GROUP_COUNT.max);

/** A pick timer in seconds: an integer from 10 to 900. */
export const parsePickSeconds = (value: unknown): Parsed =>
  parseIntIn(value, PICK_SECONDS.min, PICK_SECONDS.max);

/** "45 s", "1 min", "2 min 30 s". Built without `Intl`, so it is server-safe. */
export function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "";
  const whole = Math.round(total);
  const minutes = Math.floor(whole / 60);
  const seconds = whole % 60;
  if (minutes === 0) return `${seconds} s`;
  if (seconds === 0) return `${minutes} min`;
  return `${minutes} min ${seconds} s`;
}
