/** Squares each player drafts: 25 rounds, one pick each. */
export const ROUNDS = 25;

/** Pool size needed to start: `ceil(N / G) x 25`. */
export function requiredPool(members: number, groups: number): number {
  if (members <= 0 || groups <= 0) return 0;
  return Math.ceil(members / groups) * ROUNDS;
}

/** Group sizes, largest first, differing by at most one. Empty if `g` is not usable. */
export function groupSizes(members: number, groups: number): number[] {
  if (!Number.isInteger(groups) || groups <= 0 || members < 0) return [];
  const base = Math.floor(members / groups);
  const extra = members % groups;
  return Array.from({ length: groups }, (_, i) => base + (i < extra ? 1 : 0));
}

export type GateResult =
  | { ok: true; needed: number }
  | { ok: false; reason: "too_few_players"; needed: number }
  | { ok: false; reason: "pool_too_small"; needed: number };

/** Whether a draft can start with these numbers; the first failing reason if not. */
export function startGate(input: {
  members: number;
  groups: number;
  pool: number;
}): GateResult {
  const needed = requiredPool(input.members, input.groups);
  if (input.members < 1 || input.members < input.groups) {
    return { ok: false, reason: "too_few_players", needed };
  }
  if (input.pool < needed)
    return { ok: false, reason: "pool_too_small", needed };
  return { ok: true, needed };
}
