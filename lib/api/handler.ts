import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { ApiError } from "./errors";
import { fail } from "./response";

/** A short, log-safe description: name, database code and message, no stack. */
function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return `${error.name}${typeof code === "string" ? ` [${code}]` : ""}: ${error.message}`;
  }
  return "non-error value thrown";
}

function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return fail(error.reason, error.status);
  }
  // Server-side only: the client still gets a generic reason.
  console.error("[api] unexpected error:", describeError(error));
  return fail("internal_error", 500);
}

interface HandleOptions<I, P> {
  /** Validate the request. Throw {@link ApiError} to reject it. */
  parse: (request: NextRequest, params: P) => I | Promise<I>;
  /** Do the work for a signed-in user. May throw {@link ApiError}. */
  run: (args: { user: SessionUser; input: I }) => Promise<NextResponse>;
}

/**
 * The standard route order from `conventions.md`: validate input, authenticate,
 * then run. `ApiError` becomes `{ ok: false, reason }`; anything else becomes
 * `500 internal_error` with no detail.
 */
export function handle<I, P = Record<string, never>>(
  options: HandleOptions<I, P>,
) {
  return async (
    request: NextRequest,
    context: { params: Promise<P> },
  ): Promise<NextResponse> => {
    try {
      const params = await context.params;
      const input = await options.parse(request, params);
      const user = await getSessionUser();
      if (user === null) {
        return fail("unauthenticated", 401);
      }
      return await options.run({ user, input });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

interface HandlePublicOptions<I> {
  /** Validate the request and enforce any gate. Throw {@link ApiError} to reject. */
  parse: (request: NextRequest) => I | Promise<I>;
  run: (args: { input: I }) => Promise<NextResponse>;
}

/**
 * For the rare route that must work without a session (the dev-only sign-in). Same
 * error mapping as {@link handle}. Every use must gate itself in `parse` and be listed
 * in `lib/auth/access.ts`.
 */
export function handlePublic<I>(options: HandlePublicOptions<I>) {
  return async (request: NextRequest): Promise<NextResponse> => {
    try {
      const input = await options.parse(request);
      return await options.run({ input });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
