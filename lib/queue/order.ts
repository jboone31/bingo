/** Queue ordering helpers. Pure and client-safe. */

/** A new array with the item at `from` moved to `to` (clamped into range). */
export function moveItem<T>(
  items: readonly T[],
  from: number,
  to: number,
): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/** Move one id up (-1) or down (1). No change at either end or for an unknown id. */
export function moveById(
  ids: readonly string[],
  id: string,
  delta: -1 | 1,
): string[] {
  const index = ids.indexOf(id);
  if (index === -1) return [...ids];
  return moveItem(ids, index, index + delta);
}

/** True when both lists hold exactly the same ids, each once (any order). */
export function isPermutation(
  a: readonly string[],
  b: readonly string[],
): boolean {
  if (a.length !== b.length) return false;
  if (new Set(a).size !== a.length) return false;
  const inA = new Set(a);
  return b.every((id) => inA.has(id)) && new Set(b).size === b.length;
}

export function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
