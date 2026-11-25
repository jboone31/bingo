/**
 * Post-sign-in redirect safety. `next` comes from the query string, so only a
 * same-site relative path is accepted; anything else becomes the home page.
 */
const FALLBACK = "/";
const DUMMY_ORIGIN = "http://localhost";

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** The path if it is a safe same-site relative path, else `/`. */
export function safeNext(raw: string | null | undefined): string {
  if (typeof raw !== "string" || raw === "") {
    return FALLBACK;
  }
  if (!raw.startsWith("/") || raw.startsWith("//")) {
    return FALLBACK;
  }
  if (raw.includes("\\") || CONTROL_CHARS.test(raw)) {
    return FALLBACK;
  }
  try {
    if (new URL(raw, DUMMY_ORIGIN).origin !== DUMMY_ORIGIN) {
      return FALLBACK;
    }
  } catch {
    return FALLBACK;
  }
  return raw;
}
