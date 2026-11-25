import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getSql } from "@/lib/db/server";

/**
 * Live checks for the profiles table, trigger and RLS. Users are inserted into
 * auth.users directly (the trigger fires) and deleted afterwards.
 */
const hasDb = Boolean(process.env.SUPABASE_DB_URL?.trim());

const created: string[] = [];

async function createUser(meta: Record<string, unknown>): Promise<string> {
  const id = randomUUID();
  await getSql()`
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (${id}, 'authenticated', 'authenticated',
            ${`${id}@example.test`}, ${getSql().json(meta as never)})
  `;
  created.push(id);
  return id;
}

async function displayName(id: string): Promise<string | undefined> {
  const rows = await getSql()`
    select display_name from public.profiles where id = ${id}
  `;
  return rows[0]?.display_name as string | undefined;
}

/** Run `fn` as an authenticated user (or anon) inside a rolled-back transaction. */
async function asRole<T>(
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

describe.skipIf(!hasDb)("profiles", () => {
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    alice = await createUser({ full_name: "  Alice Example  " });
    bob = await createUser({ name: "Bob" });
  });

  afterAll(async () => {
    if (created.length > 0) {
      await getSql()`delete from auth.users where id in ${getSql()(created)}`;
    }
    await closeDb();
  });

  it("creates one profile with the trimmed Google name", async () => {
    expect(await displayName(alice)).toBe("Alice Example");
    const rows = await getSql()`
      select count(*)::int as n from public.profiles where id = ${alice}
    `;
    expect(rows[0].n).toBe(1);
  });

  it("falls back to the `name` metadata key", async () => {
    expect(await displayName(bob)).toBe("Bob");
  });

  it("uses Player xxxx when no name is given", async () => {
    const id = await createUser({});
    expect(await displayName(id)).toBe(`Player ${id.slice(0, 4)}`);
  });

  it("cuts an overlong name to 40 characters", async () => {
    const id = await createUser({ full_name: "x".repeat(60) });
    expect(await displayName(id)).toBe("x".repeat(40));
  });

  it("lets the owner read their own profile only", async () => {
    const own = await asRole("authenticated", alice, async (tx) => {
      return tx`select id from public.profiles`;
    });
    expect(own.map((r) => r.id)).toEqual([alice]);
  });

  it("hides profiles from anon", async () => {
    const rows = await asRole("anon", null, async (tx) => {
      return tx`select id from public.profiles`.catch(() => []);
    });
    expect(rows).toHaveLength(0);
  });

  it("rejects direct writes by an authenticated user", async () => {
    const update = asRole("authenticated", alice, async (tx) => {
      const res = await tx`
        update public.profiles set display_name = 'Hacked' where id = ${alice}
        returning id
      `;
      return res.length;
    });
    // No update policy: either zero rows change or the statement is denied.
    await update.then(
      (n) => expect(n).toBe(0),
      () => undefined,
    );
    expect(await displayName(alice)).toBe("Alice Example");

    await expect(
      asRole("authenticated", alice, (tx) => {
        return tx`insert into public.profiles (id, display_name)
                  values (${randomUUID()}, 'x')`;
      }),
    ).rejects.toThrow();

    const deleted = await asRole("authenticated", alice, async (tx) => {
      const res =
        await tx`delete from public.profiles where id = ${alice} returning id`;
      return res.length;
    }).catch(() => 0);
    expect(deleted).toBe(0);
    expect(await displayName(alice)).toBe("Alice Example");
  });

  it("deletes the profile with the auth user", async () => {
    const id = await createUser({ full_name: "Temp" });
    await getSql()`delete from auth.users where id = ${id}`;
    expect(await displayName(id)).toBeUndefined();
  });

  it("backfill is idempotent", async () => {
    await getSql()`
      insert into public.profiles (id, display_name)
      select id, 'dup' from auth.users where id = ${alice}
      on conflict (id) do nothing
    `;
    expect(await displayName(alice)).toBe("Alice Example");
  });
});
