/**
 * A fresh random UUID for request ids, safe in any browser context.
 *
 * `crypto.randomUUID()` exists only in secure contexts (HTTPS or localhost). Opening
 * the dev server from a phone over `http://<lan-ip>` is not a secure context, so
 * calling it throws and takes the whole component down. `crypto.getRandomValues` is
 * available everywhere, so fall back to building a version 4 UUID from it.
 */
export function newRequestId(
  source: Pick<Crypto, "getRandomValues"> & {
    randomUUID?: () => string;
  } = globalThis.crypto,
): string {
  if (typeof source.randomUUID === "function") {
    return source.randomUUID();
  }
  const bytes = new Uint8Array(16);
  source.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
