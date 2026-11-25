import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getSql } from "@/lib/db/server";
import { getPublicEnv } from "@/lib/env";
import { exactPattern, searchPattern } from "@/lib/pool/query";
import { cleanup, createLeague, createUser, hasDb } from "./helpers";

/**
 * Checks for the queue and filter reads that a unit test cannot see:
 * - the search and category patterns match literally in Postgres;
 * - the API's schema cache knows the queue embed and the category view.
 * The API checks use only the public (browser) key and no session, so the table
 * grants answer "permission denied" once the relationship is found.
 */

describe.skipIf(!hasDb)(
  "search patterns in Postgres",
  { timeout: 60_000 },
  () => {
    let league: string;

    const texts = [
      "100% sure",
      "under_score",
      "back\\slash",
      'say "hello"',
      "star * here",
      "plain text",
      "Mixed Case TEXT",
    ];

    beforeAll(async () => {
      const admin = await createUser({ full_name: "Pattern Admin" });
      league = await createLeague(admin);
      const sql = getSql();
      await sql`insert into public.submissions (league_id, text, category)
              select ${league}, t, '' from unnest(${texts}::text[]) as t`;
      await sql`insert into public.submissions (league_id, text, category) values
              (${league}, 'c1', 'Sports'), (${league}, 'c2', 'sports'),
              (${league}, 'c3', 'Sports 2'), (${league}, 'c4', 'sp_rts'),
              (${league}, 'c5', '100%')`;
    });

    afterAll(async () => {
      await cleanup();
      await closeDb();
    });

    const search = async (term: string) =>
      (
        await getSql()`select text from public.submissions
                      where league_id = ${league} and text ilike ${searchPattern(term)}
                      order by seq`
      ).map((r) => r.text as string);

    const category = async (key: string) =>
      (
        await getSql()`select text from public.submissions
                      where league_id = ${league} and category ilike ${exactPattern(key)}
                      order by seq`
      ).map((r) => r.text as string);

    it("treats % as a literal percent sign", async () => {
      expect(await search("100%")).toEqual(["100% sure"]);
      expect(await search("%")).toEqual(["100% sure"]);
    });

    it("treats _ as a literal underscore, not any one character", async () => {
      expect(await search("under_score")).toEqual(["under_score"]);
      expect(await search("under_s")).toEqual(["under_score"]);
      expect(await search("r_s")).toEqual(["under_score"]);
      expect(await search("_")).toEqual(["under_score"]);
    });

    it("matches backslashes and quotes literally", async () => {
      expect(await search("back\\slash")).toEqual(["back\\slash"]);
      expect(await search("\\")).toEqual(["back\\slash"]);
      expect(await search('"hello"')).toEqual(['say "hello"']);
    });

    it("ignores case and matches substrings", async () => {
      expect(await search("mixed case")).toEqual(["Mixed Case TEXT"]);
      expect(await search("TEXT")).toEqual(["plain text", "Mixed Case TEXT"]);
    });

    it("drops asterisks, which the API would otherwise treat as wildcards", async () => {
      expect(searchPattern("a*b")).toBe("%ab%");
      expect(await search("star")).toContain("star * here");
    });

    it("matches a category exactly, ignoring case, with no wildcards", async () => {
      expect(await category("sports")).toEqual(["c1", "c2"]);
      expect(await category("sp_rts")).toEqual(["c4"]);
      expect(await category("100%")).toEqual(["c5"]);
      expect(await category("sp%")).toEqual([]);
    });
  },
);

describe.skipIf(!hasDb)(
  "the API knows the new schema",
  { timeout: 30_000 },
  () => {
    const { supabaseUrl, supabaseKey } = getPublicEnv();

    const ask = async (path: string) => {
      const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        headers: { apikey: supabaseKey },
      });
      const body = (await res.json().catch(() => ({}))) as { code?: string };
      return { status: res.status, code: body.code };
    };

    it("finds the queue to submissions relationship by its constraint name", async () => {
      const result = await ask(
        "queue_items?select=position,submissions!queue_items_submission_fkey(id,text)&limit=1",
      );
      // Found the relationship; the anonymous caller is then refused by the table grant.
      expect(result.code).not.toBe("PGRST200");
      expect(result.code).not.toBe("PGRST205");
    });

    it("finds the pool_categories view", async () => {
      const result = await ask(
        "pool_categories?select=key,label,count&limit=1",
      );
      expect(result.code).not.toBe("PGRST205");
      expect(result.code).not.toBe("PGRST200");
    });

    it("does not let an anonymous caller read either", async () => {
      for (const path of [
        "queue_items?select=id&limit=1",
        "pool_categories?select=key&limit=1",
      ]) {
        const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
          headers: { apikey: supabaseKey },
        });
        if (res.ok) {
          expect(await res.json()).toEqual([]);
        } else {
          expect([401, 403]).toContain(res.status);
        }
      }
    });
  },
);
