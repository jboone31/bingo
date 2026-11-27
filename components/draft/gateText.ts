import { groupSizes, startGate } from "@/lib/draft/gate";
import { formatSeconds } from "@/lib/draft/settings";

/** Plain text describing the start gate. Pure and server-safe (no `Intl`). */
export interface GateText {
  readonly ok: boolean;
  /** "Pool 340 / 375 needed". */
  readonly pool: string;
  /** "3 groups of 5" or "3 groups: 5, 5, 4". */
  readonly groups: string;
  /** Why the draft cannot start, or null. */
  readonly problem: string | null;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export function gateText(input: {
  members: number;
  groups: number;
  pool: number;
}): GateText {
  const gate = startGate(input);
  const sizes = groupSizes(input.members, input.groups);
  const even = sizes.every((s) => s === sizes[0]);
  const groups =
    sizes.length === 0
      ? ""
      : even
        ? `${plural(sizes.length, "group", "groups")} of ${sizes[0]}`
        : `${plural(sizes.length, "group", "groups")}: ${sizes.join(", ")}`;
  let problem: string | null = null;
  if (!gate.ok && gate.reason === "too_few_players") {
    problem = `${plural(input.members, "player", "players")} is too few for ${plural(input.groups, "group", "groups")}.`;
  } else if (!gate.ok) {
    const short = gate.needed - input.pool;
    problem = `The pool needs ${plural(short, "more square", "more squares")}.`;
  }
  return {
    ok: gate.ok,
    pool: `Pool ${input.pool} / ${gate.needed} needed`,
    groups,
    problem,
  };
}

export const timerText = (seconds: number) =>
  `${formatSeconds(seconds)} per pick`;
