/**
 * Date and time formatting. Timestamps are stored as UTC `timestamptz` and shown
 * in the viewer's own time zone. Pure: no React, safe on server and client.
 */
export const INVALID_DATE = "Invalid date";

export interface FormatOptions {
  /** IANA zone. Defaults to the runtime's zone. */
  readonly timeZone?: string;
  /** Append the zone abbreviation, for example `CST` or `UTC`. */
  readonly showZone?: boolean;
  /** BCP 47 locale. Defaults to the runtime's locale. */
  readonly locale?: string;
}

/** Format an ISO timestamp as a date and time. Never throws. */
export function formatDateTime(
  iso: string,
  options: FormatOptions = {},
): string {
  const date = new Date(iso);
  if (typeof iso !== "string" || Number.isNaN(date.getTime())) {
    return INVALID_DATE;
  }
  try {
    return new Intl.DateTimeFormat(options.locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: options.timeZone,
      ...(options.showZone ? { timeZoneName: "short" as const } : {}),
    } as Intl.DateTimeFormatOptions).format(date);
  } catch {
    return INVALID_DATE;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The `YYYY-MM-DDTHH:mm` value for a `datetime-local` input, in local time. */
export function isoToLocalInput(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const LOCAL_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/;

/** A UTC ISO timestamp from a `datetime-local` value (read as local time). */
export function localInputToIso(value: string): string | null {
  if (typeof value !== "string" || !LOCAL_INPUT.test(value)) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
