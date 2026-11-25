import { NextResponse } from "next/server";

/** `{ ok: true, ...data }` with the given status. */
export function ok(
  data: Record<string, unknown> = {},
  status = 200,
): NextResponse {
  return NextResponse.json({ ok: true, ...data }, { status });
}

/** `{ ok: false, reason }`. Never put raw error text in `reason`. */
export function fail(reason: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, reason }, { status });
}
