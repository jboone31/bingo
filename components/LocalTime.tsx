"use client";

import { useSyncExternalStore } from "react";
import { formatDateTime } from "@/lib/format/dateTime";

const subscribe = () => () => {};

/**
 * A timestamp shown in the viewer's own time zone. The server render (and the
 * hydration pass) shows UTC with a label. React then swaps in the local text, so
 * there is no hydration mismatch.
 */
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => formatDateTime(iso, { showZone: true }),
    () => formatDateTime(iso, { timeZone: "UTC", showZone: true }),
  );
  return <time dateTime={iso}>{text}</time>;
}
