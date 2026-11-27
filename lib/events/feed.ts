import { catchUpPlan } from "./catchUp";
import { foldEvents, stateFromInitial, type EventState } from "./fold";
import { eventFromRow, type EventRow } from "./rows";
import { CATCH_UP_PAGE, type LeagueEvent } from "./types";

export type Connection = "connecting" | "live" | "offline";

/** Where events come from. The Supabase version lives in `components/realtime`. */
export interface EventSource {
  /**
   * Start listening for inserted rows. `onStatus` reports the channel: `subscribed`
   * on every (re)subscription, `down` when it closes or errors. Returns a function
   * that stops listening.
   */
  subscribe(
    onInsert: (row: EventRow) => void,
    onStatus: (status: "subscribed" | "down") => void,
  ): () => void;
  /** Rows with `seq` greater than `afterSeq`, ascending, at most `limit`. */
  fetchAfter(afterSeq: number, limit: number): Promise<EventRow[]>;
}

export interface FeedSnapshot {
  /** Ascending by seq. */
  readonly events: readonly LeagueEvent[];
  readonly connection: Connection;
}

/**
 * One league's live event list. It listens first, then reads what it missed, and
 * runs every event through {@link foldEvents}, so order, duplicates and holes are
 * handled in one place. Catch-up reads are coalesced: one at a time, and a request
 * made during a read runs once more afterwards.
 */
export class EventFeed {
  private state: EventState;
  private connection: Connection = "connecting";
  private stop: (() => void) | null = null;
  private stopped = false;
  private running = false;
  private rerun = false;

  constructor(
    private readonly source: EventSource,
    initial: readonly LeagueEvent[],
    private readonly onChange: (snapshot: FeedSnapshot) => void,
  ) {
    this.state = stateFromInitial(initial);
  }

  get snapshot(): FeedSnapshot {
    return { events: this.state.events, connection: this.connection };
  }

  /** Subscribe. Call once. */
  start(): void {
    if (this.stop !== null || this.stopped) return;
    this.stop = this.source.subscribe(
      (row) => this.receive(row),
      (status) => this.onStatus(status),
    );
  }

  /** Stop listening. Safe to call more than once. */
  close(): void {
    this.stopped = true;
    this.stop?.();
    this.stop = null;
  }

  /** Read anything missed (reconnect, tab visible again, the quiet-period timer). */
  recheck(): void {
    void this.catchUp(true);
  }

  private emit(): void {
    if (!this.stopped) this.onChange(this.snapshot);
  }

  private apply(events: readonly LeagueEvent[]): void {
    const before = this.state;
    this.state = foldEvents(this.state, events);
    if (this.state !== before) this.emit();
  }

  private receive(row: EventRow): void {
    const event = eventFromRow(row);
    if (event === null) return;
    this.apply([event]);
    if (this.state.hasGap) void this.catchUp(false);
  }

  private onStatus(status: "subscribed" | "down"): void {
    this.connection = status === "subscribed" ? "live" : "offline";
    this.emit();
    if (status === "subscribed") void this.catchUp(true);
  }

  private async catchUp(forced: boolean): Promise<void> {
    if (this.stopped) return;
    if (this.running) {
      this.rerun = this.rerun || forced || this.state.hasGap;
      return;
    }
    this.running = true;
    try {
      let again = forced;
      do {
        this.rerun = false;
        await this.readPages(again);
        again = this.rerun;
      } while (again && !this.stopped);
    } finally {
      this.running = false;
    }
  }

  /** Read pages until a short page arrives, or nothing new does. */
  private async readPages(forced: boolean): Promise<void> {
    let force = forced;
    while (!this.stopped) {
      const plan = catchUpPlan(this.state, force);
      if (plan === null) return;
      force = true;
      let rows: EventRow[];
      try {
        rows = await this.source.fetchAfter(plan.afterSeq, CATCH_UP_PAGE);
      } catch {
        // Keep the last good state. The next trigger tries again.
        return;
      }
      const events: LeagueEvent[] = [];
      for (const row of rows) {
        const event = eventFromRow(row);
        if (event) events.push(event);
      }
      const before = this.state.lastSeq;
      this.apply(events);
      if (rows.length < CATCH_UP_PAGE || this.state.lastSeq === before) return;
    }
  }
}
