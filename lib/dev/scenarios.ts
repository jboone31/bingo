/**
 * Seed scenarios as data. Later features append entries (pool, queue and draft
 * states); the dev page and routes read this registry and need no changes.
 * Pure and client-safe.
 */
import {
  adminTransferred,
  draftDateChanged,
  joinCodeRegenerated,
  memberJoined,
  memberLeft,
  poolChanged,
} from "@/lib/events/payload";
import type { EventDraft } from "@/lib/events/types";

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
  /** Squares in your queue (F4). Needs a pool at least this big. */
  readonly viewerQueueSize: number;
  /** Squares in each seed player's queue (F4). */
  readonly fakeQueueSize: number;
  /** League events to seed, oldest first, spread over the past (F5). */
  readonly eventCount: number;
  /** Draft groups (F6). */
  readonly groupCount: number;
  /** Seconds per pick (F6). */
  readonly pickSeconds: number;
  /** Start the draft through the real start code once the pool is in (F6). */
  readonly startDraft: boolean;
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
      viewerQueueSize: 0,
      fakeQueueSize: 0,
      eventCount: 0,
      groupCount: 1,
      pickSeconds: 60,
      startDraft: false,
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
      viewerQueueSize: 0,
      fakeQueueSize: 0,
      eventCount: 0,
      groupCount: 1,
      pickSeconds: 60,
      startDraft: false,
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
      viewerQueueSize: 0,
      fakeQueueSize: 0,
      eventCount: 0,
      groupCount: 1,
      pickSeconds: 60,
      startDraft: false,
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
      viewerQueueSize: 0,
      fakeQueueSize: 0,
      eventCount: 0,
      groupCount: 1,
      pickSeconds: 60,
      startDraft: false,
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
      viewerQueueSize: 0,
      fakeQueueSize: 0,
      eventCount: 0,
      groupCount: 1,
      pickSeconds: 60,
      startDraft: false,
    },
  },
  queue_started: {
    label: "Queue started",
    description:
      "Pre-draft. As the League with a pool, plus 8 squares in your queue and 10 in each seed player's.",
    plan: {
      leagueName: "[Seed] Queue started",
      viewerRole: "admin",
      fakeMembers: 11,
      fakeAdmin: false,
      draftAtOffsetDays: 7,
      poolSubmissions: 60,
      viewerQueueSize: 8,
      fakeQueueSize: 10,
      eventCount: 0,
      groupCount: 1,
      pickSeconds: 60,
      startDraft: false,
    },
  },
  league_with_activity: {
    label: "League with activity",
    description:
      "Pre-draft. As the League with a pool (40 squares), plus 60 past events, so the activity list shows its 50-event limit. The events are sample noise, not a record of what the data really did.",
    plan: {
      leagueName: "[Seed] League with activity",
      viewerRole: "admin",
      fakeMembers: 11,
      fakeAdmin: false,
      draftAtOffsetDays: 7,
      poolSubmissions: 40,
      viewerQueueSize: 0,
      fakeQueueSize: 0,
      eventCount: 60,
      groupCount: 1,
      pickSeconds: 60,
      startDraft: false,
    },
  },
  ready_three_groups: {
    label: "Ready: three groups",
    description:
      "Pre-draft. You are the admin with 14 players (15 in all), 3 groups and 125 squares: exactly enough to start.",
    plan: {
      leagueName: "[Seed] Ready, three groups",
      viewerRole: "admin",
      fakeMembers: 14,
      fakeAdmin: false,
      draftAtOffsetDays: 7,
      poolSubmissions: 125,
      viewerQueueSize: 0,
      fakeQueueSize: 0,
      eventCount: 0,
      groupCount: 3,
      pickSeconds: 60,
      startDraft: false,
    },
  },
  pool_short: {
    label: "Pool too small",
    description:
      "Pre-draft. You are the admin with 14 players (15 in all), 1 group and 100 of the 375 squares needed, so Start is blocked.",
    plan: {
      leagueName: "[Seed] Pool too small",
      viewerRole: "admin",
      fakeMembers: 14,
      fakeAdmin: false,
      draftAtOffsetDays: 7,
      poolSubmissions: 100,
      viewerQueueSize: 0,
      fakeQueueSize: 0,
      eventCount: 0,
      groupCount: 1,
      pickSeconds: 60,
      startDraft: false,
    },
  },
  draft_started: {
    label: "Draft started",
    description:
      "Drafting. As Ready: three groups, then started by the real start code. Queues of 8 for you and 10 for each seed player. No clock until F7.",
    plan: {
      leagueName: "[Seed] Draft started",
      viewerRole: "admin",
      fakeMembers: 14,
      fakeAdmin: false,
      draftAtOffsetDays: 0,
      poolSubmissions: 125,
      viewerQueueSize: 8,
      fakeQueueSize: 10,
      eventCount: 0,
      groupCount: 3,
      pickSeconds: 60,
      startDraft: true,
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
      viewerQueueSize: 0,
      fakeQueueSize: 0,
      eventCount: 0,
      groupCount: 1,
      pickSeconds: 60,
      startDraft: false,
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

/** Greatest common divisor, for choosing a stride that visits every index once. */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Which pool positions (0-based) go in a seeded queue, in queue order. Steps through
 * the pool with a stride that shares no factor with its size, so every pick is
 * distinct and the order looks scrambled, but the same `salt` always gives the same
 * result. `size` is capped at the pool size.
 */
export function seedQueueOrder(
  poolSize: number,
  size: number,
  salt: number,
): number[] {
  if (poolSize <= 0 || size <= 0) return [];
  const count = Math.min(size, poolSize);
  let stride = (Math.abs(salt) * 7 + 3) % poolSize || 1;
  while (gcd(stride, poolSize) !== 1) {
    stride = (stride % poolSize) + 1;
  }
  const start = Math.abs(salt) % poolSize;
  return Array.from(
    { length: count },
    (_, i) => (start + i * stride) % poolSize,
  );
}
/** Minutes between consecutive seeded events. */
export const SEED_EVENT_GAP_MINUTES = 20;

/**
 * Deterministic sample events for a scenario, oldest first. `names` are display
 * names to use (at least one). The mix covers every event type. The sequence is
 * sample noise: it does not describe how the league's data was really built.
 */
export function seedEventDrafts(
  count: number,
  names: readonly string[],
): EventDraft[] {
  const pick = (i: number) => names[i % Math.max(names.length, 1)] ?? "Someone";
  const drafts: EventDraft[] = [];
  for (let i = 0; i < count; i += 1) {
    switch (i % 8) {
      case 0:
        drafts.push(memberJoined(pick(i)));
        break;
      case 1:
        drafts.push(poolChanged("imported", 10 + (i % 5)));
        break;
      case 2:
        drafts.push(memberJoined(pick(i + 1)));
        break;
      case 3:
        drafts.push(poolChanged("added", 1));
        break;
      case 4:
        drafts.push(
          draftDateChanged(i % 16 === 4 ? null : "2026-03-01T19:00:00.000Z"),
        );
        break;
      case 5:
        drafts.push(poolChanged(i % 16 === 5 ? "edited" : "deleted", 1));
        break;
      case 6:
        drafts.push(joinCodeRegenerated());
        break;
      default:
        drafts.push(
          i % 16 === 7
            ? memberLeft(pick(i))
            : adminTransferred(pick(i), pick(i + 1)),
        );
    }
  }
  return drafts;
}
