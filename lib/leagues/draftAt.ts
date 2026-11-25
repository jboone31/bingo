export type ParsedDraftAt =
  | { ok: true; value: string | null }
  | { ok: false; reason: "invalid_draft_at" };

/**
 * The draft date as a UTC ISO string. `undefined` or `null` means "not set".
 * Past dates are allowed. Anything that is not a parseable timestamp string is
 * rejected.
 */
export function parseDraftAt(input: unknown): ParsedDraftAt {
  if (input === undefined || input === null) {
    return { ok: true, value: null };
  }
  if (typeof input !== "string" || input.trim() === "") {
    return { ok: false, reason: "invalid_draft_at" };
  }
  const date = new Date(input);
  const year = date.getUTCFullYear();
  if (Number.isNaN(date.getTime()) || year < 2000 || year > 2100) {
    return { ok: false, reason: "invalid_draft_at" };
  }
  return { ok: true, value: date.toISOString() };
}
