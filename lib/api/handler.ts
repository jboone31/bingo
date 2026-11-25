import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { ApiError } from "./errors";
import { fail } from "./response";

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
      if (error instanceof ApiError) {
        return fail(error.reason, error.status);
      }
      return fail("internal_error", 500);
    }
  };
}
