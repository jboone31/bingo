import "server-only";
import type { QueryRunner } from "@/lib/db/server";

export interface Profile {
  readonly id: string;
  readonly displayName: string;
}

/**
 * Set a user's display name. Idempotent: repeating it with the same name leaves
 * the same result. Returns `null` when the user has no profile row.
 */
export async function updateProfile(
  tx: QueryRunner,
  userId: string,
  displayName: string,
): Promise<Profile | null> {
  const { rows } = await tx.query(
    `update public.profiles
        set display_name = $1, updated_at = now()
      where id = $2
      returning id, display_name`,
    [displayName, userId],
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return { id: String(row.id), displayName: String(row.display_name) };
}
