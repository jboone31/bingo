/** League name validation. Mirrors the database check on `leagues.name`. */
export const LEAGUE_NAME_MAX = 60;

export type ParsedLeagueName =
  { ok: true; value: string } | { ok: false; reason: "invalid_name" };

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

/** Trim and validate a league name (1 to 60 code points, no control chars). */
export function parseLeagueName(input: unknown): ParsedLeagueName {
  if (typeof input !== "string") {
    return { ok: false, reason: "invalid_name" };
  }
  const value = input.trim();
  const length = [...value].length;
  if (length < 1 || length > LEAGUE_NAME_MAX || CONTROL_CHARS.test(value)) {
    return { ok: false, reason: "invalid_name" };
  }
  return { ok: true, value };
}
