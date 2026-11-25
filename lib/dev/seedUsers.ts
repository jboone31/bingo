import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSql } from "@/lib/db/server";
import { getPublicEnv, requireServiceRoleKey } from "@/lib/env";
import {
  SEED_POOL_SIZE,
  parseSeedEmail,
  seedEmail,
  seedName,
} from "./seedIdentity";

/**
 * The shared pool of fake players. They are real auth users created through the
 * admin API (service-role key, server only), so RLS and routes treat them like
 * anyone else. A user is a seed user only if it passes {@link parseSeedEmail} and
 * has `seed: true` in metadata.
 */

export interface SeedUser {
  readonly id: string;
  readonly number: number;
  readonly displayName: string;
}

function adminClient(): SupabaseClient {
  return createClient(getPublicEnv().supabaseUrl, requireServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Every existing seed user, ordered by number. */
export async function listSeedUsers(): Promise<SeedUser[]> {
  const rows = await getSql()`
    select u.id, u.email, p.display_name
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.email like 'seed-player-%@bingo-seed.test'
      and u.raw_user_meta_data ->> 'seed' = 'true'
  `;
  return rows
    .map((row) => ({
      id: String(row.id),
      number: parseSeedEmail(row.email),
      displayName: String(row.display_name ?? row.email),
    }))
    .filter((u): u is SeedUser => u.number !== null)
    .sort((a, b) => a.number - b.number);
}

/**
 * Make sure players 1 to `count` exist and return their ids in order, so index 0 is
 * player 1. Creates only the missing ones.
 */
export async function ensureSeedUsers(count: number): Promise<string[]> {
  if (!Number.isInteger(count) || count < 0 || count > SEED_POOL_SIZE) {
    throw new RangeError(`seed player count out of range: ${count}`);
  }
  if (count === 0) return [];
  const existing = new Map(
    (await listSeedUsers()).map((u) => [u.number, u.id]),
  );
  const missing: number[] = [];
  for (let n = 1; n <= count; n += 1) {
    if (!existing.has(n)) missing.push(n);
  }
  if (missing.length > 0) {
    const admin = adminClient();
    for (let i = 0; i < missing.length; i += 10) {
      const batch = missing.slice(i, i + 10);
      const results = await Promise.all(
        batch.map((n) =>
          admin.auth.admin.createUser({
            email: seedEmail(n),
            email_confirm: true,
            user_metadata: { seed: true, full_name: seedName(n) },
          }),
        ),
      );
      results.forEach((result, index) => {
        if (result.error || !result.data.user) {
          throw new Error("could not create a seed user");
        }
        existing.set(batch[index], result.data.user.id);
      });
    }
  }
  return Array.from({ length: count }, (_, i) => existing.get(i + 1) as string);
}

/** Delete every seed user. Returns how many were removed. */
export async function deleteAllSeedUsers(): Promise<number> {
  const users = await listSeedUsers();
  if (users.length === 0) return 0;
  const admin = adminClient();
  let removed = 0;
  for (let i = 0; i < users.length; i += 10) {
    const results = await Promise.all(
      users.slice(i, i + 10).map((u) => admin.auth.admin.deleteUser(u.id)),
    );
    for (const result of results) {
      if (result.error) throw new Error("could not delete a seed user");
      removed += 1;
    }
  }
  return removed;
}

/** The admin client, for act-as. Server only. */
export { adminClient };
