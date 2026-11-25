import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { decideAccess } from "@/lib/auth/access";
import { getPublicEnv } from "@/lib/env";

/**
 * Refreshes the Supabase session for a request and applies route access rules.
 * Every returned response carries any cookies the refresh set.
 */
export const createClient = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Verifies the JWT and refreshes the cookie. Any failure counts as signed out.
  let isAuthenticated = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    isAuthenticated = !error && typeof data?.claims?.sub === "string";
  } catch {
    isAuthenticated = false;
  }

  const { pathname, search } = request.nextUrl;
  const decision = decideAccess(pathname, isAuthenticated, search);

  if (decision.kind === "allow") {
    return supabaseResponse;
  }
  const response =
    decision.kind === "unauthorized"
      ? NextResponse.json(
          { ok: false, reason: "unauthenticated" },
          { status: 401 },
        )
      : NextResponse.redirect(new URL(decision.to, request.url));
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });
  return response;
};
