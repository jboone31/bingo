import { sameOrder } from "./order";

/**
 * Saves queue orders one request at a time. Changes made while a request is in
 * flight are folded into the next one, so requests never overlap and the last change
 * always wins. A failure puts the order back to the last one the server accepted.
 * Framework-free so the sequencing can be tested without a browser.
 */
export type SaveResult = { ok: true } | { ok: false; reason: string };

export class OrderSaver {
  private saved: string[];
  private wanted: string[];
  private running = false;

  constructor(
    initial: readonly string[],
    private readonly send: (order: string[]) => Promise<SaveResult>,
    private readonly onFailed: (reason: string, lastSaved: string[]) => void,
  ) {
    this.saved = [...initial];
    this.wanted = [...initial];
  }

  /** The order the server last accepted. */
  get lastSaved(): string[] {
    return [...this.saved];
  }

  /** Forget everything and treat `order` as saved (after a reload or a removal). */
  reset(order: readonly string[]): void {
    this.saved = [...order];
    this.wanted = [...order];
  }

  /** Ask for `order` to be saved. Sends now, or right after the current request. */
  request(order: readonly string[]): void {
    this.wanted = [...order];
    if (!this.running) void this.flush();
  }

  private async flush(): Promise<void> {
    this.running = true;
    try {
      while (!sameOrder(this.wanted, this.saved)) {
        const sending = [...this.wanted];
        let result: SaveResult;
        try {
          result = await this.send(sending);
        } catch {
          result = { ok: false, reason: "network" };
        }
        if (result.ok) {
          this.saved = sending;
        } else {
          this.wanted = [...this.saved];
          this.onFailed(result.reason, this.lastSaved);
          return;
        }
      }
    } finally {
      this.running = false;
    }
  }
}
