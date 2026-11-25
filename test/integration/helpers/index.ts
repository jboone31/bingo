import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db/server";

/**
 * Shared helpers for live-database suites. Users are inserted into auth.users
 * directly (the profile trigger fires) and removed by {@link cleanup}. F2.5 extends
 * these into the seed tooling.
 */
export const hasDb = Boolean(process.env.SUPABASE_DB_URL?.trim());

const users: string[] = [];
const leagues: string[] = [];

export async function createUser(
  meta: Record<string, unknown> = {},
): Promise<string> {
  const id = randomUUID();
  await getSql()`
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (${id}, 'authenticated', 'authenticated',
            ${`${id}@example.test`}, ${getSql().json(meta as never)})
  `;
  users.push(id);
  return id;
}

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** A random valid join code. */
export function randomCode(): string {
  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

/** Insert a league and its admin membership. */
export async function createLeague(
  adminId: string,
  options: { name?: string; status?: string } = {},
): Promise<string> {
  const rows = await getSql()`
    insert into public.leagues (name, status, join_code, created_by)
    values (${options.name ?? "Test League"}, ${options.status ?? "pre_draft"},
            ${randomCode()}, ${adminId})
    returning id
  `;
  const id = rows[0].id as string;
  leagues.push(id);
  await getSql()`
    insert into public.league_members (league_id, user_id, role)
    values (${id}, ${adminId}, 'admin')
  `;
  return id;
}

export async function addMember(
  leagueId: string,
  userId: string,
  role: "admin" | "member" = "member",
): Promise<void> {
  await getSql()`
    insert into public.league_members (league_id, user_id, role)
    values (${leagueId}, ${userId}, ${role})
  `;
}

/** Delete everything the helpers created. Leagues first (created_by restricts). */
export async function cleanup(): Promise<void> {
  const sql = getSql();
  if (leagues.length > 0) {
    await sql`delete from public.leagues where id in ${sql(leagues)}`;
  }
  if (users.length > 0) {
    await sql`delete from public.leagues where created_by in ${sql(users)}`;
    await sql`delete from auth.users where id in ${sql(users)}`;
  }
}

/**
 * Run `fn` as an authenticated user (or anon) inside a transaction that is always
 * rolled back, so a write attempt never persists.
 */
export async function asRole<T>(
  role: "authenticated" | "anon",
  userId: string | null,
  fn: (tx: ReturnType<typeof getSql>) => Promise<T>,
): Promise<T> {
  const rollback = Symbol("rollback");
  let result!: T;
  try {
    await getSql().begin(async (tx) => {
      await tx`select set_config('role', ${role}, true)`;
      if (userId) {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role })}, true)`;
      }
      result = await fn(tx as unknown as ReturnType<typeof getSql>);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result;
}
