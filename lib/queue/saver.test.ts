import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { OrderSaver, type SaveResult } from "./saver";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A send function whose results the test controls. */
function controlled() {
  const calls: { order: string[]; resolve: (r: SaveResult) => void }[] = [];
  const send = (order: string[]) =>
    new Promise<SaveResult>((resolve) => {
      calls.push({ order, resolve });
    });
  return { calls, send };
}

describe("OrderSaver", () => {
  it("sends a requested order and records it as saved", async () => {
    const { calls, send } = controlled();
    const saver = new OrderSaver(["a", "b"], send, vi.fn());
    saver.request(["b", "a"]);
    expect(calls).toHaveLength(1);
    expect(calls[0].order).toEqual(["b", "a"]);
    calls[0].resolve({ ok: true });
    await flushPromises();
    expect(saver.lastSaved).toEqual(["b", "a"]);
  });

  it("sends nothing when the order is unchanged", () => {
    const { calls, send } = controlled();
    new OrderSaver(["a", "b"], send, vi.fn()).request(["a", "b"]);
    expect(calls).toHaveLength(0);
  });

  it("never overlaps requests and sends the latest change last", async () => {
    const { calls, send } = controlled();
    const saver = new OrderSaver(["a", "b", "c"], send, vi.fn());
    saver.request(["b", "a", "c"]);
    saver.request(["b", "c", "a"]);
    saver.request(["c", "b", "a"]);
    // Only the first request is in flight; the rest wait.
    expect(calls).toHaveLength(1);
    calls[0].resolve({ ok: true });
    await flushPromises();
    // The two waiting changes collapse into one request holding the newest order.
    expect(calls).toHaveLength(2);
    expect(calls[1].order).toEqual(["c", "b", "a"]);
    calls[1].resolve({ ok: true });
    await flushPromises();
    expect(saver.lastSaved).toEqual(["c", "b", "a"]);
    expect(calls).toHaveLength(2);
  });

  it("skips the second request when the user changes back to the saved order", async () => {
    const { calls, send } = controlled();
    const saver = new OrderSaver(["a", "b"], send, vi.fn());
    saver.request(["b", "a"]);
    saver.request(["a", "b"]);
    calls[0].resolve({ ok: true });
    await flushPromises();
    // Saved is now ["b","a"], wanted ["a","b"]: one more request is needed.
    expect(calls).toHaveLength(2);
    expect(calls[1].order).toEqual(["a", "b"]);
  });

  it("reports a failure with the last saved order and stops", async () => {
    const { calls, send } = controlled();
    const onFailed = vi.fn();
    const saver = new OrderSaver(["a", "b"], send, onFailed);
    saver.request(["b", "a"]);
    saver.request(["a", "b"]);
    calls[0].resolve({ ok: false, reason: "queue_changed" });
    await flushPromises();
    expect(onFailed).toHaveBeenCalledWith("queue_changed", ["a", "b"]);
    expect(saver.lastSaved).toEqual(["a", "b"]);
    expect(calls).toHaveLength(1);
  });

  it("treats a thrown error as a network failure", async () => {
    const onFailed = vi.fn();
    const saver = new OrderSaver(
      ["a", "b"],
      async () => {
        throw new Error("offline");
      },
      onFailed,
    );
    saver.request(["b", "a"]);
    await flushPromises();
    expect(onFailed).toHaveBeenCalledWith("network", ["a", "b"]);
  });

  it("can send again after a failure", async () => {
    const { calls, send } = controlled();
    const saver = new OrderSaver(["a", "b"], send, vi.fn());
    saver.request(["b", "a"]);
    calls[0].resolve({ ok: false, reason: "network" });
    await flushPromises();
    saver.request(["b", "a"]);
    expect(calls).toHaveLength(2);
  });

  it("reset adopts a new saved order", () => {
    const { calls, send } = controlled();
    const saver = new OrderSaver(["a", "b"], send, vi.fn());
    saver.reset(["b"]);
    saver.request(["b"]);
    expect(calls).toHaveLength(0);
    expect(saver.lastSaved).toEqual(["b"]);
  });

  it("after any run of changes and successes, the saved order is the last one asked for", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.shuffledSubarray(["a", "b", "c", "d"], {
            minLength: 4,
            maxLength: 4,
          }),
          {
            minLength: 1,
            maxLength: 8,
          },
        ),
        async (orders) => {
          const sent: string[][] = [];
          const saver = new OrderSaver(
            ["a", "b", "c", "d"],
            async (order) => {
              sent.push(order);
              await flushPromises();
              return { ok: true };
            },
            vi.fn(),
          );
          for (const order of orders) saver.request(order);
          await new Promise((resolve) =>
            setTimeout(resolve, 5 * (orders.length + 1)),
          );
          expect(saver.lastSaved).toEqual(orders[orders.length - 1]);
        },
      ),
      { numRuns: 40 },
    );
  });
});
