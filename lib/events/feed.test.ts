import { describe, expect, it, vi } from "vitest";
import { EventFeed, type EventSource, type FeedSnapshot } from "./feed";
import type { EventRow } from "./rows";
import { CATCH_UP_PAGE, type LeagueEvent } from "./types";

const row = (seq: number): EventRow => ({
  id: `id-${seq}`,
  league_id: "league",
  seq,
  type: "pool_changed",
  payload: {},
  actor_id: null,
  created_at: "2026-01-01T00:00:00Z",
});
const ev = (seq: number): LeagueEvent => ({
  id: `id-${seq}`,
  leagueId: "league",
  seq,
  type: "pool_changed",
  payload: {},
  actorId: null,
  createdAt: "2026-01-01T00:00:00Z",
});

/** A fake source: `server` holds every event; tests push live rows by hand. */
function fakeSource(server: number[] = []) {
  let onInsert: (r: EventRow) => void = () => {};
  let onStatus: (s: "subscribed" | "down") => void = () => {};
  const unsubscribe = vi.fn();
  const fetchAfter = vi.fn(async (after: number, limit: number) =>
    server
      .filter((s) => s > after)
      .sort((a, b) => a - b)
      .slice(0, limit)
      .map(row),
  );
  const source: EventSource = {
    subscribe(i, s) {
      onInsert = i;
      onStatus = s;
      return unsubscribe;
    },
    fetchAfter,
  };
  return {
    source,
    server,
    fetchAfter,
    unsubscribe,
    insert: (seq: number) => onInsert(row(seq)),
    status: (s: "subscribed" | "down") => onStatus(s),
  };
}

const seqs = (snap: FeedSnapshot) => snap.events.map((e) => e.seq);
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function start(server: number[], initial: LeagueEvent[]) {
  const fake = fakeSource(server);
  const changes: FeedSnapshot[] = [];
  const feed = new EventFeed(fake.source, initial, (s) => changes.push(s));
  feed.start();
  return { fake, feed, changes };
}

describe("EventFeed", () => {
  it("reads missed events when the channel reports subscribed", async () => {
    const { fake, feed } = start([1, 2, 3, 4], [ev(1), ev(2)]);
    fake.status("subscribed");
    await settle();
    expect(seqs(feed.snapshot)).toEqual([1, 2, 3, 4]);
    expect(feed.snapshot.connection).toBe("live");
    expect(fake.fetchAfter).toHaveBeenCalledWith(2, CATCH_UP_PAGE);
  });

  it("applies a live event once, even when delivered twice", async () => {
    const { fake, feed } = start([1, 2], [ev(1)]);
    fake.insert(2);
    fake.insert(2);
    await settle();
    expect(seqs(feed.snapshot)).toEqual([1, 2]);
    expect(fake.fetchAfter).not.toHaveBeenCalled();
  });

  it("reads the missing events when a live event skips ahead", async () => {
    const { fake, feed } = start([1, 2, 3, 4], [ev(1)]);
    fake.insert(4);
    await settle();
    expect(seqs(feed.snapshot)).toEqual([1, 2, 3, 4]);
    expect(fake.fetchAfter).toHaveBeenCalledWith(1, CATCH_UP_PAGE);
  });

  it("keeps the last good state when a read fails, and retries on the next trigger", async () => {
    const { fake, feed } = start([1, 2], [ev(1)]);
    fake.fetchAfter.mockRejectedValueOnce(new Error("network"));
    fake.status("subscribed");
    await settle();
    expect(seqs(feed.snapshot)).toEqual([1]);
    feed.recheck();
    await settle();
    expect(seqs(feed.snapshot)).toEqual([1, 2]);
  });

  it("reads further pages until a short one arrives", async () => {
    const server = Array.from({ length: CATCH_UP_PAGE + 5 }, (_, i) => i + 1);
    const { fake, feed } = start(server, []);
    fake.status("subscribed");
    await settle();
    expect(feed.snapshot.events).toHaveLength(CATCH_UP_PAGE + 5);
    expect(fake.fetchAfter).toHaveBeenCalledTimes(2);
  });

  it("does not loop when a read adds nothing", async () => {
    const { fake, feed } = start([], [ev(1)]);
    feed.recheck();
    await settle();
    expect(fake.fetchAfter).toHaveBeenCalledTimes(1);
  });

  it("runs one read at a time and once more for a request made during it", async () => {
    const fake = fakeSource([1, 2]);
    let release: () => void = () => {};
    let calls = 0;
    fake.fetchAfter.mockImplementation(async (after: number) => {
      calls += 1;
      if (calls === 1) await new Promise<void>((r) => (release = r));
      return [1, 2].filter((s) => s > after).map(row);
    });
    const feed = new EventFeed(fake.source, [], () => {});
    feed.start();
    feed.recheck();
    feed.recheck();
    feed.recheck();
    expect(fake.fetchAfter).toHaveBeenCalledTimes(1);
    release();
    await settle();
    expect(fake.fetchAfter).toHaveBeenCalledTimes(2);
    expect(seqs(feed.snapshot)).toEqual([1, 2]);
  });

  it("shows offline when the channel goes down and live again on resubscribe", async () => {
    const { fake, feed } = start([1], []);
    expect(feed.snapshot.connection).toBe("connecting");
    fake.status("down");
    expect(feed.snapshot.connection).toBe("offline");
    fake.status("subscribed");
    await settle();
    expect(feed.snapshot.connection).toBe("live");
    expect(seqs(feed.snapshot)).toEqual([1]);
  });

  it("ignores unusable rows", async () => {
    const { fake, feed } = start([], [ev(1)]);
    (fake.insert as (seq: number) => void)(0);
    await settle();
    expect(seqs(feed.snapshot)).toEqual([1]);
  });

  it("stops listening and emits nothing after close", async () => {
    const { fake, feed, changes } = start([1, 2], [ev(1)]);
    feed.close();
    expect(fake.unsubscribe).toHaveBeenCalledTimes(1);
    const count = changes.length;
    fake.insert(2);
    feed.recheck();
    await settle();
    expect(changes).toHaveLength(count);
    feed.close();
    expect(fake.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("does not report older history under a capped first load as missing", async () => {
    const { fake, feed } = start([], [ev(60), ev(59)]);
    fake.insert(61);
    await settle();
    expect(seqs(feed.snapshot)).toEqual([59, 60, 61]);
    expect(fake.fetchAfter).not.toHaveBeenCalled();
  });
});
