import "server-only";
import { cookies } from "next/headers";
import { getSql } from "@/lib/db/server";
import { createClient } from "@/utils/supabase/server";
import { isSeedUser } from "./seedIdentity";
import { adminClient } from "./seedUsers";

/**
 * Switch this browser to a real session for a seed user. The target is re-read from
 * the database and must pass {@link isSeedUser}, so a crafted request cannot
 * impersonate a real user. The one-time token is used immediately and never leaves
 * the server. Returns `false` if the target is not a seed user or the switch fails.
 */
export async function actAs(userId: string): Promise<boolean> {
  const rows = await getSql()`
    select email, raw_user_meta_data as metadata
    from auth.users where id = ${userId}
  `;
  const target = rows[0];
  if (
    !target ||
    !isSeedUser({
      email: target.email,
      metadata: target.metadata as Record<string, unknown> | null,
    })
  ) {
    return false;
  }

  const link = await adminClient().auth.admin.generateLink({
    type: "magiclink",
    email: String(target.email),
  });
  const tokenHash = link.data?.properties?.hashed_token;
  if (link.error || !tokenHash) return false;

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });
  return !error;
}
