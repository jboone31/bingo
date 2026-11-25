import "server-only";
import { headers } from "next/headers";
import { isDevToolsEnabled } from "@/lib/env";
import { isPrivateHost } from "./privateHost";
import { listSeedUsers, type SeedUser } from "./seedUsers";

/** Whether the dev-only sign-in is available for this request's host. */
export async function devSignInAllowed(): Promise<boolean> {
  return isDevToolsEnabled() && isPrivateHost((await headers()).get("host"));
}

/**
 * The seed players the sign-in page may offer. Empty unless dev tools are enabled
 * and the request is from a local or private-network address.
 */
export async function devSignInUsers(): Promise<SeedUser[]> {
  return (await devSignInAllowed()) ? listSeedUsers() : [];
}
