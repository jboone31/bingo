import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSessionUser }));

import { readJsonObject } from "./body";
import { ApiError } from "./errors";
import { handle } from "./handler";
import { parseUuid } from "./ids";
import { fail, ok } from "./response";

const req = (body: string) =>
  new NextRequest("http://localhost/x", { method: "POST", body });

describe("response helpers", () => {
  it("ok and fail shape the body", async () => {
    expect(await ok({ a: 1 }, 201).json()).toEqual({ ok: true, a: 1 });
    expect(ok({}, 201).status).toBe(201);
    const res = fail("nope", 409);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, reason: "nope" });
  });
});

describe("readJsonObject", () => {
  it("returns an object with allowed keys", async () => {
    expect(await readJsonObject(req('{"a":1}'), ["a"])).toEqual({ a: 1 });
  });

  it.each(["{", "[]", "1", "null", '{"a":1,"b":2}'])(
    "rejects %s",
    async (body) => {
      await expect(readJsonObject(req(body), ["a"])).rejects.toMatchObject({
        reason: "invalid_body",
        status: 400,
      });
    },
  );
});

describe("parseUuid", () => {
  it("accepts and lowercases a uuid", () => {
    expect(parseUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(
      "123e4567-e89b-12d3-a456-426614174000",
    );
  });

  it.each([["x"], [""], [1], [null], ["123e4567-e89b-12d3-a456-42661417400"]])(
    "rejects %j",
    (value) => {
      expect(() => parseUuid(value)).toThrow(ApiError);
    },
  );
});

describe("handle", () => {
  beforeEach(() => {
    getSessionUser.mockReset().mockResolvedValue({ id: "u1", email: null });
  });

  const ctx = { params: Promise.resolve({}) };

  it("runs parse, then auth, then run", async () => {
    const order: string[] = [];
    getSessionUser.mockImplementation(async () => {
      order.push("auth");
      return { id: "u1", email: null };
    });
    const route = handle({
      parse: () => {
        order.push("parse");
        return 5;
      },
      run: async ({ user, input }) => {
        order.push("run");
        return ok({ user: user.id, input });
      },
    });
    const res = await route(req("{}"), ctx);
    expect(order).toEqual(["parse", "auth", "run"]);
    expect(await res.json()).toEqual({ ok: true, user: "u1", input: 5 });
  });

  it("rejects bad input before checking the session", async () => {
    const route = handle({
      parse: () => {
        throw new ApiError("invalid_body", 400);
      },
      run: async () => ok(),
    });
    const res = await route(req("{}"), ctx);
    expect(res.status).toBe(400);
    expect(getSessionUser).not.toHaveBeenCalled();
  });

  it("returns 401 when signed out", async () => {
    getSessionUser.mockResolvedValue(null);
    const run = vi.fn();
    const route = handle({ parse: () => 1, run });
    const res = await route(req("{}"), ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ ok: false, reason: "unauthenticated" });
    expect(run).not.toHaveBeenCalled();
  });

  it("maps ApiError from run to its reason", async () => {
    const route = handle({
      parse: () => 1,
      run: async () => {
        throw new ApiError("not_admin", 403);
      },
    });
    const res = await route(req("{}"), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, reason: "not_admin" });
  });

  it("logs unexpected errors on the server only", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const route = handle({
      parse: () => 1,
      run: async () => {
        throw Object.assign(new Error("boom"), { code: "23505" });
      },
    });
    const res = await route(req("{}"), ctx);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
    expect(spy).toHaveBeenCalledWith(
      "[api] unexpected error:",
      "Error [23505]: boom",
    );
    spy.mockRestore();
  });

  it("hides unexpected errors", async () => {
    const route = handle({
      parse: () => 1,
      run: async () => {
        throw new Error("password=hunter2");
      },
    });
    const res = await route(req("{}"), ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ ok: false, reason: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("hunter2");
  });

  it("passes route params to parse", async () => {
    const route = handle<string, { id: string }>({
      parse: (_req, params) => params.id,
      run: async ({ input }) => ok({ input }),
    });
    const res = await route(req("{}"), {
      params: Promise.resolve({ id: "abc" }),
    });
    expect(await res.json()).toEqual({ ok: true, input: "abc" });
  });
});
