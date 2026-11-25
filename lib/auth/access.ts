/**
 * Route access decisions for `proxy.ts`. Pure so it can be property tested.
 * Add new public machine routes (for example cron) to the list below.
 */
export type AccessDecision =
  | { kind: "allow" }
  | { kind: "redirect"; to: string }
  | { kind: "unauthorized" };

export const SIGN_IN_PATH = "/sign-in";

const PUBLIC_EXACT: readonly string[] = [SIGN_IN_PATH, "/api/health"];
const PUBLIC_PREFIXES: readonly string[] = ["/api/auth/"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isApi(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/**
 * Decide what to do with a request. `search` is the query string including the
 * leading `?`, or an empty string.
 */
export function decideAccess(
  pathname: string,
  isAuthenticated: boolean,
  search = "",
): AccessDecision {
  if (pathname === SIGN_IN_PATH && isAuthenticated) {
    return { kind: "redirect", to: "/" };
  }
  if (isPublic(pathname) || isAuthenticated) {
    return { kind: "allow" };
  }
  if (isApi(pathname)) {
    return { kind: "unauthorized" };
  }
  const next = encodeURIComponent(`${pathname}${search}`);
  return { kind: "redirect", to: `${SIGN_IN_PATH}?next=${next}` };
}
