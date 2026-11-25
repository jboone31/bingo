/**
 * Whether a request's Host header is a local or private-network address. The dev
 * sign-in only works from such hosts, so even if dev tools were switched on for a
 * deployed preview, the public hostname would still be refused. This is a second
 * layer behind `isDevToolsEnabled()`, not a replacement for it. Pure.
 */

/** The hostname from a Host header, lowercased, without port or trailing dot. */
export function hostnameOf(
  hostHeader: string | null | undefined,
): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.trim().toLowerCase();
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end < 0 ? null : host.slice(0, end + 1);
  }
  const colon = host.lastIndexOf(":");
  const name = (colon === -1 ? host : host.slice(0, colon)).replace(/\.$/, "");
  return name === "" ? null : name;
}

const OCTET = "(0|[1-9]\\d{0,2})";
const IPV4 = new RegExp(`^${OCTET}\\.${OCTET}\\.${OCTET}\\.${OCTET}$`);

export function isPrivateHost(hostHeader: string | null | undefined): boolean {
  const host = hostnameOf(hostHeader);
  if (host === null) return false;
  if (
    host === "localhost" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  ) {
    return true;
  }
  const match = IPV4.exec(host);
  if (match === null) return false;
  const [a, b, c, d] = match.slice(1).map(Number);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}
