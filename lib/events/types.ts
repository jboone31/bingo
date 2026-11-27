/** One row of `league_events`, in the shape clients use. */
export interface LeagueEvent {
  readonly id: string;
  readonly leagueId: string;
  /** Per-league sequence, starting at 1, with no gaps. */
  readonly seq: number;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly actorId: string | null;
  /** ISO timestamp (UTC). */
  readonly createdAt: string;
}

/** What a mutation point appends: the type and payload, before seq and ids exist. */
export interface EventDraft {
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
}

export const POOL_CHANGE_KINDS = [
  "added",
  "imported",
  "edited",
  "deleted",
  "cleared",
] as const;
export type PoolChangeKind = (typeof POOL_CHANGE_KINDS)[number];

/** The database caps a payload at this many bytes. */
export const MAX_PAYLOAD_BYTES = 2000;

/** The page size for catch-up reads and the overview's first load. */
export const CATCH_UP_PAGE = 200;
export const RECENT_EVENTS = 50;
