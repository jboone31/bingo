import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import { DB_URL_VAR } from "@/lib/env";

/** Node.js runtime: the DB check opens a real Postgres connection. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbStatus = "ok" | "unconfigured" | "error";

/** Check database connectivity without leaking connection details. */
async function checkDb(): Promise<DbStatus> {
  if (!process.env[DB_URL_VAR]?.trim()) {
    return "unconfigured";
  }
  try {
    await getSql()`select 1`;
    return "ok";
  } catch {
    return "error";
  }
}

/** GET /api/health: liveness plus database connectivity. */
export async function GET(): Promise<NextResponse> {
  const db = await checkDb();
  return NextResponse.json(
    { ok: db !== "error", db },
    { status: db === "error" ? 503 : 200 },
  );
}
