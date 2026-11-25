/**
 * Join codes: 8 characters from an alphabet without look-alikes (no 0, O, 1, I, L).
 * Stored normalized (no hyphen); shown as `K7P2-QX9M`. Pure: the random source is
 * passed in so this module is safe in the browser.
 */
export const JOIN_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const JOIN_CODE_LENGTH = 8;

/** Build a code from `randomInt(max)`, which returns an integer in `[0, max)`. */
export function generateJoinCode(randomInt: (max: number) => number): string {
  let code = "";
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return code;
}

/**
 * The stored form of a user-entered code (uppercased, spaces and hyphens
 * removed), or `null` if it cannot be a valid code.
 */
export function normalizeJoinCode(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const code = raw.replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== JOIN_CODE_LENGTH) {
    return null;
  }
  for (const char of code) {
    if (!JOIN_CODE_ALPHABET.includes(char)) {
      return null;
    }
  }
  return code;
}

/** `K7P2QX9M` as `K7P2-QX9M`. */
export function formatJoinCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
