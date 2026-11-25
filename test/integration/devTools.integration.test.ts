import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, getSql, withTransaction } from "@/lib/db/server";
import { actAs } from "@/lib/dev/actAs";
import { resetMine } from "@/lib/dev/reset";
import { SCENARIOS, planFor, totalMembers } from "@/lib/dev/scenarios";
import { listSeedUsers } from "@/lib/dev/seedUsers";
import { seedScenario } from "@/lib/dev/seedScenario";
import { cleanup, createLeague, createUser, hasDb } from "./helpers";

/**
 * Live checks for the dev tools. These use the service-role key (through the code
 * under test) and create fake players, so they run only with an explicit
 * `npm run test:integration`. They never call resetAll: that would also remove the
 * seed data you are using by hand. Fake players are a shared pool and are left in
 * place.
 */

describe.skipIf(!hasDb)("dev tools", () => {
  let viewer: string;

  beforeAll(async () => {
    viewer = await createUser({ full_name: "Dev Viewer" });
  });

  afterAll(async () => {
    await withTransaction((tx) => resetMine(tx, viewer));
    await cleanup();
    await closeDb();
  });

  const members = async (leagueId: string) =>
    getSql()`
      select user_id, role from public.league_members where league_id = ${leagueId}`;

  it.each(Object.keys(SCENARIOS))(
    "%s builds the planned league",
    async (name) => {
      const plan = planFor(name)!;
      const id = (await seedScenario(viewer, name))!;
      const [league] = await getSql()`
        select name, status, seed_scenario, draft_at from public.leagues where id = ${id}`;
      expect(league.name).toBe(plan.leagueName);
      expect(league.status).toBe("pre_draft");
      expect(league.seed_scenario).toBe(name);
      expect(league.draft_at === null).toBe(plan.draftAtOffsetDays === null);

      const rows = await members(id);
      expect(rows).toHaveLength(totalMembers(plan));
      const pool = await getSql()`
        select count(*)::int as n from public.submissions where league_id = ${id}`;
      expect(pool[0].n).toBe(plan.poolSubmissions);
      const queues = await getSql()`
        select user_id, count(*)::int as n from public.queue_items
         where league_id = ${id} group by user_id`;
      const byUser = new Map(
        queues.map((r) => [r.user_id as string, r.n as number]),
      );
      expect(byUser.get(viewer) ?? 0).toBe(plan.viewerQueueSize);
      const others = [...byUser.entries()].filter(([user]) => user !== viewer);
      expect(others.length).toBe(plan.fakeQueueSize > 0 ? plan.fakeMembers : 0);
      for (const [, n] of others) expect(n).toBe(plan.fakeQueueSize);
      expect(rows.filter((r) => r.role === "admin")).toHaveLength(1);
      const mine = rows.find((r) => r.user_id === viewer)!;
      expect(mine.role).toBe(plan.viewerRole);
    },
    120_000,
  );

  it("running a scenario twice makes two leagues", async () => {
    const a = await seedScenario(viewer, "league_empty");
    const b = await seedScenario(viewer, "league_empty");
    expect(a).not.toBe(b);
  });

  it("returns null for an unknown scenario", async () => {
    expect(await seedScenario(viewer, "nope")).toBeNull();
  });

  it("reset mine removes seed leagues and leaves untagged leagues alone", async () => {
    const real = await createLeague(viewer, { name: "Real league" });
    await seedScenario(viewer, "league_empty");
    const removed = await withTransaction((tx) => resetMine(tx, viewer));
    expect(removed).toBeGreaterThan(0);
    const seeded = await getSql()`
      select 1 from public.leagues l
      join public.league_members m on m.league_id = l.id
      where m.user_id = ${viewer} and l.seed_scenario is not null`;
    expect(seeded).toHaveLength(0);
    const kept =
      await getSql()`select 1 from public.leagues where id = ${real}`;
    expect(kept).toHaveLength(1);
  });

  it("seed users are the reserved pattern only, and real users are untouched", async () => {
    const users = await listSeedUsers();
    expect(users.length).toBeGreaterThan(0);
    const rows =
      await getSql()`select email from auth.users where id = ${viewer}`;
    expect(users.map((u) => u.id)).not.toContain(viewer);
    expect(String(rows[0].email)).not.toContain("seed-player");
  });

  it("act-as refuses a non-seed user", async () => {
    expect(await actAs(viewer)).toBe(false);
  });
});
