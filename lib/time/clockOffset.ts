/**
 * Estimating the server clock from the browser. One sample is a request sent at
 * `sentAt`, answered at `receivedAt` (both client milliseconds), carrying the
 * server's `serverNow`. Assuming the reply took equal time each way, the server read
 * its clock at the client's midpoint, so offset = serverNow - midpoint.
 */
export interface ClockSample {
  readonly sentAt: number;
  readonly receivedAt: number;
  readonly serverNow: number;
}

export interface ClockEstimate {
  /** Add to the client clock to get server time. */
  readonly offsetMs: number;
  /** The round trip, a bound on the estimate's error (half of it, at worst). */
  readonly rttMs: number;
}

/** Longer round trips are not trusted. */
export const MAX_RTT_MS = 5000;

/** The estimate from one sample, or null when it cannot be trusted. */
export function estimateOffset(sample: ClockSample): ClockEstimate | null {
  const { sentAt, receivedAt, serverNow } = sample;
  if (![sentAt, receivedAt, serverNow].every(Number.isFinite)) return null;
  const rttMs = receivedAt - sentAt;
  if (rttMs < 0 || rttMs > MAX_RTT_MS) return null;
  const midpoint = sentAt + rttMs / 2;
  return { offsetMs: serverNow - midpoint, rttMs };
}

/** The best usable estimate: the one with the shortest round trip. */
export function bestEstimate(
  samples: readonly ClockSample[],
): ClockEstimate | null {
  let best: ClockEstimate | null = null;
  for (const sample of samples) {
    const estimate = estimateOffset(sample);
    if (estimate && (best === null || estimate.rttMs < best.rttMs))
      best = estimate;
  }
  return best;
}
