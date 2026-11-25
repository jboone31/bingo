"use client";

import { useSyncExternalStore } from "react";
import { formatDateTime, formatUtcStable } from "@/lib/format/dateTime";

const subscribe = () => () => {};

/**
 * A timestamp shown in the viewer's own time zone. The server render (and the
 * hydration pass) shows UTC with a label, built without `Intl` so the text is the
 * same on the server and in any browser. React then swaps in the local text.
 */
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => formatDateTime(iso, { showZone: true }),
    () => formatUtcStable(iso),
  );
  return <time dateTime={iso}>{text}</time>;
}
