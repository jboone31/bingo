import { ROUNDS } from "./gate";

/**
 * A pure model of the draft engine. The real engine is SQL (migration 0011) so the
 * pg_cron backstop can run it; this model states the same rules for property tests,
 * and integration tests check the SQL against it.
 */

/** Picks in a group of `size`: 25 each. */
export const totalPicks = (size: number): number => size * ROUNDS;

/** Round and draft position on the clock for 1-based pick `pick` (snake order). */
export function onClock(
  pick: number,
  size: number,
): { round: number; position: number } {
  const round = Math.ceil(pick / size);
  const index = (pick - 1) % size;
  const position = round % 2 === 1 ? index + 1 : size - index;
  return { round, position };
}

/**
 * The next deadline in milliseconds. A manual pick restarts the clock from the pick.
 * An auto-pick for a missed deadline keeps the schedule (missed deadline + timer), so
 * several missed turns settle in one pass. A bot pick restarts from the pick time.
 */
export function nextDeadline(input: {
  kind: "manual" | "auto" | "bot";
  at: number;
  deadline: number;
  pickSeconds: number;
}): number {
  const basis =
    input.kind === "auto" ? Math.min(input.deadline, input.at) : input.at;
  return basis + input.pickSeconds * 1000;
}

/** The top queued square not yet taken, else a random untaken pool square. */
export function autoChoice(
  queue: readonly string[],
  taken: ReadonlySet<string>,
  pool: readonly string[],
  randomInt: (max: number) => number,
): string | null {
  for (const id of queue) if (!taken.has(id)) return id;
  const open = pool.filter((id) => !taken.has(id));
  if (open.length === 0) return null;
  return open[randomInt(open.length)];
}

export interface ModelPick {
  readonly pickNumber: number;
  readonly round: number;
  readonly userId: string;
  readonly submissionId: string;
  readonly auto: boolean;
}

export interface ModelGroup {
  /** User ids in draft position order (position 1 first). */
  readonly order: readonly string[];
  readonly picks: readonly ModelPick[];
  /** The next pick number, 1-based. Past `totalPicks` means finished. */
  readonly nextPick: number;
  /** Milliseconds, or null once finished. */
  readonly deadline: number | null;
}

export interface ModelLeague {
  readonly pickSeconds: number;
  readonly pool: readonly string[];
  readonly queues: Readonly<Record<string, readonly string[]>>;
  readonly groups: readonly ModelGroup[];
  readonly bots: ReadonlySet<string>;
  readonly completed: boolean;
}

const finished = (g: ModelGroup) => g.nextPick > totalPicks(g.order.length);

/** The user on the clock, or null when the group is finished. */
export function userOnClock(g: ModelGroup): string | null {
  if (finished(g)) return null;
  return g.order[onClock(g.nextPick, g.order.length).position - 1];
}

function isDue(g: ModelGroup, now: number, bots: ReadonlySet<string>): boolean {
  if (finished(g) || g.deadline === null) return false;
  const user = userOnClock(g)!;
  return g.deadline <= now || bots.has(user);
}

/**
 * Auto-pick every due turn in every group until nothing is due, like
 * `settle_league`. Picked squares leave the group's queues. Returns the new league
 * and the number of auto-picks.
 */
export function settle(
  league: ModelLeague,
  now: number,
  randomInt: (max: number) => number,
): { league: ModelLeague; picks: number } {
  let groups = [...league.groups];
  const queues: Record<string, string[]> = {};
  for (const [user, q] of Object.entries(league.queues)) queues[user] = [...q];
  let picks = 0;
  for (;;) {
    const index = groups.findIndex((g) => isDue(g, now, league.bots));
    if (index === -1) break;
    const g = groups[index];
    const user = userOnClock(g)!;
    const taken = new Set(g.picks.map((p) => p.submissionId));
    const choice = autoChoice(
      queues[user] ?? [],
      taken,
      league.pool,
      randomInt,
    );
    if (choice === null) throw new Error("pool exhausted");
    const kind = league.bots.has(user) && g.deadline! > now ? "bot" : "auto";
    const pick: ModelPick = {
      pickNumber: g.nextPick,
      round: onClock(g.nextPick, g.order.length).round,
      userId: user,
      submissionId: choice,
      auto: true,
    };
    for (const member of g.order) {
      if (queues[member])
        queues[member] = queues[member].filter((s) => s !== choice);
    }
    const nextPick = g.nextPick + 1;
    const done = nextPick > totalPicks(g.order.length);
    groups[index] = {
      ...g,
      picks: [...g.picks, pick],
      nextPick,
      deadline: done
        ? null
        : nextDeadline({
            kind,
            at: now,
            deadline: g.deadline!,
            pickSeconds: league.pickSeconds,
          }),
    };
    picks += 1;
    groups = [...groups];
  }
  return {
    league: {
      ...league,
      queues,
      groups,
      completed: league.completed || groups.every(finished),
    },
    picks,
  };
}
