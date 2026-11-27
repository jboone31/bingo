import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getSql, withTransaction } from "@/lib/db/server";
import { listMySeedLeagues, resetOne } from "@/lib/dev/reset";
import { startDraft } from "@/lib/draft/start";
import { addMember, cleanup, createLeague, createUser, hasDb } from "./helpers";

/**
 * Single seed-league reset. Uses ordinary test users and tags leagues by hand, so it
 * needs no service-role key (unlike devTools.integration).
 */
describe.skipIf(!hasDb)("dev reset one league", { timeout: 60_000 }, () => {
  let me: string;
  let other: string;

  const tag = (id: string, scenario = "league_empty") =>
    getSql()`update public.leagues set seed_scenario = ${scenario} where id = ${id}`;
  const exists = async (id: string) =>
    (await getSql()`select 1 from public.leagues where id = ${id}`).length ===
    1;

  beforeAll(async () => {
    me = await createUser({ full_name: "R Me" });
    other = await createUser({ full_name: "R Other" });
  });

  afterAll(async () => {
    await cleanup();
    await closeDb();
  });

  it("deletes only the chosen seed league and leaves the rest", async () => {
    const a = await createLeague(me);
    const b = await createLeague(me);
    const real = await createLeague(me);
    await tag(a);
    await tag(b);
    expect(await withTransaction((tx) => resetOne(tx, me, a))).toBe(true);
    expect(await exists(a)).toBe(false);
    expect(await exists(b)).toBe(true);
    expect(await exists(real)).toBe(true);
  });

  it("never deletes an untagged league, or a seed league you are not in", async () => {
    const real = await createLeague(me);
    const theirs = await createLeague(other);
    await tag(theirs);
    expect(await withTransaction((tx) => resetOne(tx, me, real))).toBe(false);
    expect(await withTransaction((tx) => resetOne(tx, me, theirs))).toBe(false);
    expect(await exists(real)).toBe(true);
    expect(await exists(theirs)).toBe(true);
  });

  it("deletes a started seed league, with its groups and events", async () => {
    const id = await createLeague(me);
    await addMember(id, other);
    await getSql()`insert into public.submissions (league_id, text)
                   select ${id}, 'Square ' || g from generate_series(1, 50) g`;
    await withTransaction((tx) =>
      startDraft(tx, id, me, { members: 2, groupCount: 1 }),
    );
    await tag(id, "draft_started");
    expect(await withTransaction((tx) => resetOne(tx, me, id))).toBe(true);
    expect(await exists(id)).toBe(false);
    const left = await getSql()`
      select (select count(*) from public.draft_groups where league_id = ${id})::int as g,
             (select count(*) from public.league_events where league_id = ${id})::int as e`;
    expect(left[0]).toEqual({ g: 0, e: 0 });
  });

  it("lists only your seed leagues, newest first", async () => {
    const older = await createLeague(me, { name: "Older" });
    await tag(older);
    const newer = await createLeague(me, { name: "Newer" });
    await tag(newer, "pool_ready");
    const real = await createLeague(me, { name: "Real" });
    const list = await withTransaction((tx) => listMySeedLeagues(tx, me));
    const ids = list.map((l) => l.id);
    expect(ids).toContain(older);
    expect(ids).not.toContain(real);
    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));
    expect(list.find((l) => l.id === newer)).toMatchObject({
      name: "Newer",
      scenario: "pool_ready",
      status: "pre_draft",
    });
  });
});
