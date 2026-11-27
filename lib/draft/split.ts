import { groupSizes } from "./gate";

export interface GroupPlan {
  /** 1 to G. */
  readonly number: number;
  /** Draft order: position 1 picks first in round 1. */
  readonly members: readonly {
    readonly userId: string;
    readonly position: number;
  }[];
}

/** `randomInt(max)` returns an integer in `[0, max)`. */
export type RandomInt = (max: number) => number;

/**
 * Split members into `groups` balanced groups with a random order in each. One
 * Fisher-Yates shuffle, then dealt round-robin, so groups 1 to `N mod G` get the extra
 * player and the order inside a group is the shuffled order.
 */
export function splitIntoGroups(
  userIds: readonly string[],
  groups: number,
  randomInt: RandomInt,
): GroupPlan[] {
  const shuffled = [...userIds];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const sizes = groupSizes(shuffled.length, groups);
  const buckets: string[][] = sizes.map(() => []);
  shuffled.forEach((id, i) => buckets[i % groups].push(id));
  return buckets.map((ids, g) => ({
    number: g + 1,
    members: ids.map((userId, i) => ({ userId, position: i + 1 })),
  }));
}
