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
