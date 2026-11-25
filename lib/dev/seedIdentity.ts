/**
 * Seed (fake) player identity. Pure, so the browser can use it for display. A user
 * counts as a seed user only on an exact match of the reserved email AND the seed
 * flag in metadata, so a real account can never be matched.
 */
export const SEED_DOMAIN = "bingo-seed.test";
export const SEED_POOL_SIZE = 100;

const pad = (n: number) => String(n).padStart(3, "0");

/** `seed-player-007@bingo-seed.test` for 1 to 100. */
export function seedEmail(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > SEED_POOL_SIZE) {
    throw new RangeError(`seed player number out of range: ${n}`);
  }
  return `seed-player-${pad(n)}@${SEED_DOMAIN}`;
}

/** `Seed Player 007`. */
export function seedName(n: number): string {
  return `Seed Player ${pad(n)}`;
}

const SEED_EMAIL = /^seed-player-(\d{3})@bingo-seed\.test$/;

/** The player number for an exact seed email, else `null`. */
export function parseSeedEmail(email: unknown): number | null {
  if (typeof email !== "string") return null;
  const match = SEED_EMAIL.exec(email);
  if (!match) return null;
  const n = Number(match[1]);
  return n >= 1 && n <= SEED_POOL_SIZE ? n : null;
}

/** True only for the reserved email pattern with `seed: true` in user metadata. */
export function isSeedUser(user: {
  email: unknown;
  metadata: Record<string, unknown> | null | undefined;
}): boolean {
  return parseSeedEmail(user.email) !== null && user.metadata?.seed === true;
}
