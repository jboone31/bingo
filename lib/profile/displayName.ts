/** Display name validation. Mirrors the database check on `profiles`. */
export const DISPLAY_NAME_MAX = 40;

export type ParsedDisplayName =
  { ok: true; value: string } | { ok: false; reason: "invalid_display_name" };

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/** Trim and validate a candidate display name (1 to 40 code points). */
export function parseDisplayName(input: unknown): ParsedDisplayName {
  if (typeof input !== "string") {
    return { ok: false, reason: "invalid_display_name" };
  }
  const value = input.trim();
  const length = [...value].length;
  if (length < 1 || length > DISPLAY_NAME_MAX || CONTROL_CHARS.test(value)) {
    return { ok: false, reason: "invalid_display_name" };
  }
  return { ok: true, value };
}
