import { PAGE_SIZE } from "./limits";

/** Paging helpers for the pool list. Pure. */

export function pageCountFor(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

/** A valid page number from a raw `?page=` value: an integer from 1 to `pageCount`. */
export function clampPage(raw: unknown, pageCount: number): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, pageCount);
}

/** Zero-based inclusive row range for `Supabase.range()`. */
export function rangeFor(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}
