/**
 * Seed scenarios as data. Later features append entries (pool, queue and draft
 * states); the dev page and routes read this registry and need no changes.
 * Pure and client-safe.
 */
export interface ScenarioPlan {
  readonly leagueName: string;
  /** Your role in the new league. */
  readonly viewerRole: "admin" | "member";
  /** Seed players added besides you. When `fakeAdmin`, one of them is the admin. */
  readonly fakeMembers: number;
  readonly fakeAdmin: boolean;
  /** Days from now for the draft date, or `null` for none. */
  readonly draftAtOffsetDays: number | null;
  /** Generated pool submissions to add (F3). */
  readonly poolSubmissions: number;
}

export interface Scenario {
  readonly label: string;
  readonly description: string;
  readonly plan: ScenarioPlan;
}

export const SCENARIOS: Readonly<Record<string, Scenario>> = {
  league_empty: {
    label: "Empty league",
    description: "Pre-draft. You are the admin and the only member.",
    plan: {
      leagueName: "[Seed] Empty league",
      viewerRole: "admin",
      fakeMembers: 0,
      fakeAdmin: false,
      draftAtOffsetDays: null,
      poolSubmissions: 0,
    },
  },
  league_with_players: {
    label: "League with players",
    description:
      "Pre-draft. You are the admin with 11 players and a draft date.",
    plan: {
      leagueName: "[Seed] League with players",
      viewerRole: "admin",
      fakeMembers: 11,
      fakeAdmin: false,
      draftAtOffsetDays: 7,
      poolSubmissions: 0,
    },
  },
  league_full: {
    label: "Full league",
    description: "Pre-draft. You are the admin of a league at 100 players.",
    plan: {
      leagueName: "[Seed] Full league",
      viewerRole: "admin",
      fakeMembers: 99,
      fakeAdmin: false,
      draftAtOffsetDays: 7,
      poolSubmissions: 0,
    },
  },
  league_with_pool: {
    label: "League with a pool",
    description:
      "Pre-draft. You are the admin with 11 players and 60 squares in 5 categories, 3 exact duplicates.",
    plan: {
      leagueName: "[Seed] League with a pool",
      viewerRole: "admin",
      fakeMembers: 11,
      fakeAdmin: false,
      draftAtOffsetDays: 7,
      poolSubmissions: 60,
    },
  },
  pool_ready: {
    label: "Pool ready to start",
    description:
      "Pre-draft. You are the admin with 11 players and 300 squares, enough for one group of 12.",
    plan: {
      leagueName: "[Seed] Pool ready",
      viewerRole: "admin",
      fakeMembers: 11,
      fakeAdmin: false,
      draftAtOffsetDays: 7,
      poolSubmissions: 300,
    },
  },
  member_view: {
    label: "Regular member view",
    description:
      "Pre-draft. A fake admin runs it and you are a regular member.",
    plan: {
      leagueName: "[Seed] Member view",
      viewerRole: "member",
      fakeMembers: 11,
      fakeAdmin: true,
      draftAtOffsetDays: 7,
      poolSubmissions: 0,
    },
  },
};

/** The plan for a scenario name, or `null` if there is no such scenario. */
export function planFor(name: unknown): ScenarioPlan | null {
  if (typeof name !== "string" || !Object.hasOwn(SCENARIOS, name)) {
    return null;
  }
  return SCENARIOS[name].plan;
}

/** Players in the finished league: you plus the seed players. */
export function totalMembers(plan: ScenarioPlan): number {
  return plan.fakeMembers + 1;
}

const SEED_SUBMITTERS = ["Sam", "Riley", "Jordan", "Casey", "Alex"];
const SEED_CATEGORIES = ["Sports", "Movies", "Politics", "Tech", "Weather"];

export interface SeedSubmission {
  readonly text: string;
  readonly submitter: string;
  readonly category: string;
}

/**
 * Deterministic pool rows for a scenario. Every 20th row repeats the previous row's
 * text, so duplicates exist to test with. Every 11th submitter and 13th category is
 * blank, to exercise the fallbacks.
 */
export function seedPoolRows(count: number): SeedSubmission[] {
  const rows: SeedSubmission[] = [];
  let unique = 0;
  for (let i = 1; i <= count; i += 1) {
    if (i % 20 !== 0) unique += 1;
    rows.push({
      text: `Seed square ${String(unique).padStart(3, "0")}`,
      submitter:
        i % 11 === 0 ? "" : SEED_SUBMITTERS[i % SEED_SUBMITTERS.length],
      category: i % 13 === 0 ? "" : SEED_CATEGORIES[i % SEED_CATEGORIES.length],
    });
  }
  return rows;
}
