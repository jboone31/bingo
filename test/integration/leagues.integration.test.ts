import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getSql } from "@/lib/db/server";
import {
  addMember,
  asRole,
  cleanup,
  createLeague,
  createUser,
  hasDb,
  randomCode,
} from "./helpers";

/** Live checks for leagues, league_members, their policies, triggers and helpers. */

describe.skipIf(!hasDb)("leagues", () => {
  let admin: string;
  let member: string;
  let stranger: string;
  let league: string;

  beforeAll(async () => {
    admin = await createUser({ full_name: "Admin A" });
    member = await createUser({ full_name: "Member M" });
    stranger = await createUser({ full_name: "Stranger S" });
    league = await createLeague(admin);
    await addMember(league, member);
  });

  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  describe("reads (RLS)", () => {
    it("members read the league and every member row", async () => {
      const leagues = await asRole("authenticated", member, (tx) => {
        return tx`select id from public.leagues`;
      });
      expect(leagues.map((r) => r.id)).toContain(league);
      const members = await asRole("authenticated", member, (tx) => {
        return tx`select user_id from public.league_members where league_id = ${league}`;
      });
      expect(members.map((r) => r.user_id).sort()).toEqual(
        [admin, member].sort(),
      );
    });

    it("non-members read neither", async () => {
      const leagues = await asRole("authenticated", stranger, (tx) => {
        return tx`select id from public.leagues where id = ${league}`;
      });
      expect(leagues).toHaveLength(0);
      const members = await asRole("authenticated", stranger, (tx) => {
        return tx`select user_id from public.league_members where league_id = ${league}`;
      });
      expect(members).toHaveLength(0);
    });

    it("anon reads nothing", async () => {
      const rows = await asRole("anon", null, (tx) => {
        return tx`select id from public.leagues`.catch(() => []);
      });
      expect(rows).toHaveLength(0);
    });

    it("co-members read each other's profiles; strangers are hidden", async () => {
      const visible = await asRole("authenticated", member, (tx) => {
        return tx`select id from public.profiles where id in (${admin}, ${stranger})`;
      });
      expect(visible.map((r) => r.id)).toEqual([admin]);
    });
  });

  describe("no direct writes", () => {
    it.each([
      [
        "insert league",
        (tx: ReturnType<typeof getSql>, u: string) =>
          tx`insert into public.leagues (name, join_code, created_by)
           values ('X', ${randomCode()}, ${u})`,
      ],
      [
        "update league",
        (tx: ReturnType<typeof getSql>) =>
          tx`update public.leagues set name = 'Hacked' where id = ${league}`,
      ],
      [
        "delete league",
        (tx: ReturnType<typeof getSql>) =>
          tx`delete from public.leagues where id = ${league}`,
      ],
      [
        "insert member",
        (tx: ReturnType<typeof getSql>, u: string) =>
          tx`insert into public.league_members (league_id, user_id) values (${league}, ${u})`,
      ],
      [
        "update member",
        (tx: ReturnType<typeof getSql>) =>
          tx`update public.league_members set role = 'admin' where league_id = ${league}`,
      ],
      [
        "delete member",
        (tx: ReturnType<typeof getSql>) =>
          tx`delete from public.league_members where league_id = ${league}`,
      ],
    ])("%s has no effect for a member", async (_label, run) => {
      // Either the statement is denied or it changes zero rows.
      const changed = await asRole("authenticated", member, async (tx) => {
        const result = await run(tx, member);
        return result.count;
      }).catch(() => 0);
      expect(changed).toBe(0);
      const rows =
        await getSql()`select name from public.leagues where id = ${league}`;
      expect(rows[0].name).toBe("Test League");
    });
  });

  describe("constraints and triggers", () => {
    it("allows only one admin per league", async () => {
      await expect(addMember(league, member, "admin")).rejects.toThrow();
    });

    it("demote-then-promote succeeds inside one transaction", async () => {
      const l = await createLeague(admin);
      await addMember(l, member);
      await getSql().begin(async (tx) => {
        await tx`update public.league_members set role = 'member' where league_id = ${l} and user_id = ${admin}`;
        await tx`update public.league_members set role = 'admin' where league_id = ${l} and user_id = ${member}`;
      });
      const rows = await getSql()`
        select user_id from public.league_members where league_id = ${l} and role = 'admin'`;
      expect(rows.map((r) => r.user_id)).toEqual([member]);
    });

    it("a user cannot join the same league twice", async () => {
      await expect(addMember(league, member)).rejects.toThrow();
    });

    it("status cannot move backward", async () => {
      const l = await createLeague(admin);
      await getSql()`update public.leagues set status = 'drafting' where id = ${l}`;
      await getSql()`update public.leagues set status = 'in_progress' where id = ${l}`;
      await expect(
        getSql()`update public.leagues set status = 'pre_draft' where id = ${l}`,
      ).rejects.toThrow(/league_status_backward/);
    });

    it("rejects joining a league that is no longer pre_draft", async () => {
      const l = await createLeague(admin, { status: "drafting" }).catch(
        () => null,
      );
      // createLeague inserts the admin membership, which the guard rejects.
      expect(l).toBeNull();
      const pre = await createLeague(admin);
      await getSql()`update public.leagues set status = 'drafting' where id = ${pre}`;
      await expect(addMember(pre, stranger)).rejects.toThrow(
        /league_not_pre_draft/,
      );
    });

    it("rejects the 101st member", async () => {
      const l = await createLeague(admin);
      const sql = getSql();
      // 99 more members (the admin is the first); profiles are needed first.
      const ids = Array.from({ length: 99 }, () => randomUUID());
      await sql`
        insert into auth.users (id, aud, role, email)
        select x, 'authenticated', 'authenticated', x || '@example.test'
        from unnest(${ids}::uuid[]) as x`;
      try {
        await sql`
          insert into public.league_members (league_id, user_id)
          select ${l}, x from unnest(${ids}::uuid[]) as x`.catch(async () => {
          // The guard counts per row, so a bulk insert sees the same count.
          for (const id of ids) {
            await sql`insert into public.league_members (league_id, user_id) values (${l}, ${id})`;
          }
        });
        const count =
          await sql`select count(*)::int as n from public.league_members where league_id = ${l}`;
        expect(count[0].n).toBe(100);
        await expect(addMember(l, stranger)).rejects.toThrow(/league_full/);
      } finally {
        await sql`delete from public.leagues where id = ${l}`;
        await sql`delete from auth.users where id = any(${ids}::uuid[])`;
      }
    });

    it("rejects bad join codes and duplicates", async () => {
      const bad = ["K7P2QX0M", "k7p2qx9m", "K7P2QX9", "K7P2QX9MM", "K7P2-X9M"];
      for (const code of bad) {
        await expect(
          getSql()`insert into public.leagues (name, join_code, created_by)
                   values ('X', ${code}, ${admin})`,
        ).rejects.toThrow();
      }
      const l = await createLeague(admin);
      const [{ join_code }] =
        await getSql()`select join_code from public.leagues where id = ${l}`;
      await expect(
        getSql()`insert into public.leagues (name, join_code, created_by)
                 values ('Dup', ${join_code}, ${admin})`,
      ).rejects.toThrow();
    });

    it("rejects bad names", async () => {
      for (const name of ["", " padded ", "x".repeat(61)]) {
        await expect(
          getSql()`insert into public.leagues (name, join_code, created_by)
                   values (${name}, ${randomCode()}, ${admin})`,
        ).rejects.toThrow();
      }
    });

    it("the same (created_by, create_key) cannot insert twice", async () => {
      const key = randomUUID();
      await getSql()`insert into public.leagues (name, join_code, created_by, create_key)
                     values ('K1', ${randomCode()}, ${admin}, ${key})`;
      await expect(
        getSql()`insert into public.leagues (name, join_code, created_by, create_key)
                 values ('K2', ${randomCode()}, ${admin}, ${key})`,
      ).rejects.toThrow();
      await getSql()`delete from public.leagues where created_by = ${admin} and create_key = ${key}`;
    });
  });

  describe("cascades", () => {
    it("deleting a league removes its members", async () => {
      const l = await createLeague(admin);
      await addMember(l, member);
      await getSql()`delete from public.leagues where id = ${l}`;
      const rows =
        await getSql()`select 1 from public.league_members where league_id = ${l}`;
      expect(rows).toHaveLength(0);
    });

    it("deleting a user removes their membership", async () => {
      const temp = await createUser({ full_name: "Temp" });
      await addMember(league, temp);
      await getSql()`delete from auth.users where id = ${temp}`;
      const rows =
        await getSql()`select 1 from public.league_members where user_id = ${temp}`;
      expect(rows).toHaveLength(0);
    });
  });
});
