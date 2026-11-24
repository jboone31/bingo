import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.fn();
vi.mock("@/lib/db/server", () => ({
  getSql: () => query,
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  const original = process.env.SUPABASE_DB_URL;

  beforeEach(() => {
    query.mockReset();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.SUPABASE_DB_URL;
    } else {
      process.env.SUPABASE_DB_URL = original;
    }
  });

  it("reports ok with db unconfigured when no database URL is set", async () => {
    delete process.env.SUPABASE_DB_URL;
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "unconfigured" });
    expect(query).not.toHaveBeenCalled();
  });

  it("reports db ok when the query succeeds", async () => {
    process.env.SUPABASE_DB_URL = "postgres://example";
    query.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: "ok" });
  });

  it("reports 503 when the query fails, without leaking the error", async () => {
    process.env.SUPABASE_DB_URL = "postgres://example";
    query.mockRejectedValue(new Error("password=hunter2"));
    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ ok: false, db: "error" });
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });
});
