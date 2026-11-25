import { CATEGORY_MAX, SUBMITTER_MAX, TEXT_MAX } from "./limits";

/**
 * Submission field validation. Mirrors the checks on `submissions`. Pure.
 * Text is required; submitter and category may be empty.
 */
export type FieldResult<R extends string> =
  { ok: true; value: string } | { ok: false; reason: R };

const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f]/;

function clean(input: unknown, max: number, min: number): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  const length = [...value].length;
  if (length < min || length > max || CONTROL_CHARS.test(value)) return null;
  return value;
}

export function parseText(input: unknown): FieldResult<"invalid_text"> {
  const value = clean(input, TEXT_MAX, 1);
  return value === null
    ? { ok: false, reason: "invalid_text" }
    : { ok: true, value };
}

export function parseSubmitter(
  input: unknown,
): FieldResult<"invalid_submitter"> {
  const value = clean(input ?? "", SUBMITTER_MAX, 0);
  return value === null
    ? { ok: false, reason: "invalid_submitter" }
    : { ok: true, value };
}

/** Trims and collapses runs of whitespace. Capitalization is kept as typed. */
export function parseCategory(input: unknown): FieldResult<"invalid_category"> {
  const collapsed =
    typeof input === "string" || input === undefined || input === null
      ? String(input ?? "").replace(/\s+/g, " ")
      : null;
  const value = collapsed === null ? null : clean(collapsed, CATEGORY_MAX, 0);
  return value === null
    ? { ok: false, reason: "invalid_category" }
    : { ok: true, value };
}

export const displaySubmitter = (value: string) => value || "Unknown";
export const displayCategory = (value: string) => value || "Uncategorized";
