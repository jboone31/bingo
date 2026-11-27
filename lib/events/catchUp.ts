import type { EventState } from "./fold";

/**
 * Whether to read events after the last contiguous seq. A hole always needs a read.
 * Otherwise a read happens only when the caller forces one (reconnect, tab visible,
 * the quiet-period timer). Returns the seq to read after, or null for no read.
 */
export function catchUpPlan(
  state: EventState,
  forced: boolean,
): { afterSeq: number } | null {
  if (state.hasGap || forced) return { afterSeq: state.lastSeq };
  return null;
}
