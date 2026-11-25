import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export interface SessionUser {
  readonly id: string;
  readonly email: string | null;
}

/** The signed-in user from verified JWT claims, or `null`. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || typeof claims.sub !== "string") {
    return null;
  }
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
}
