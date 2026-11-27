import type { LeagueEvent } from "./types";

/**
 * The client's view of a league's event log. Live delivery, catch-up reads and the
 * first load all go through {@link foldEvents}, so they cannot disagree.
 */
export interface EventState {
  /** Ascending by seq, no duplicates. */
  readonly events: readonly LeagueEvent[];
  /**
   * Events at or below this seq were never loaded on purpose (the first load is
   * capped), so they are not holes. 0 for a league whose log was empty.
   */
  readonly baseSeq: number;
  /** The highest seq reached from `baseSeq` without a hole. */
  readonly lastSeq: number;
  /** True when a held event is newer than `lastSeq`, so something is missing. */
  readonly hasGap: boolean;
}

export const EMPTY_STATE: EventState = {
  events: [],
  baseSeq: 0,
  lastSeq: 0,
  hasGap: false,
};

function withEvents(
  baseSeq: number,
  events: readonly LeagueEvent[],
): EventState {
  let lastSeq = baseSeq;
  for (const event of events) {
    if (event.seq === lastSeq + 1) lastSeq = event.seq;
    else if (event.seq > lastSeq + 1) break;
  }
  const newest = events.length > 0 ? events[events.length - 1].seq : baseSeq;
  return { events, baseSeq, lastSeq, hasGap: newest > lastSeq };
}

function merge(
  existing: readonly LeagueEvent[],
  incoming: readonly LeagueEvent[],
): LeagueEvent[] {
  const bySeq = new Map<number, LeagueEvent>();
  for (const event of existing) bySeq.set(event.seq, event);
  for (const event of incoming) {
    if (!bySeq.has(event.seq)) bySeq.set(event.seq, event);
  }
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}

/**
 * Build the state from a first load, in any order. The oldest event loaded sets the
 * base: anything older is history the page chose not to fetch.
 */
export function stateFromInitial(initial: readonly LeagueEvent[]): EventState {
  const events = merge([], initial);
  const baseSeq = events.length > 0 ? events[0].seq - 1 : 0;
  return withEvents(baseSeq, events);
}

/** Merge `incoming` into `state`: dedupe by seq, sort, recompute the high-water mark. */
export function foldEvents(
  state: EventState,
  incoming: readonly LeagueEvent[],
): EventState {
  const events = merge(state.events, incoming).filter(
    (event) => event.seq > state.baseSeq,
  );
  return withEvents(state.baseSeq, events);
}
