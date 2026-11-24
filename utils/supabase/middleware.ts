import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicEnv } from "@/lib/env";

/**
 * Builds the Supabase client for middleware and returns the response carrying
 * any cookies it sets.
 *
 * Session refresh (calling `auth.getClaims()` here) is added with the auth
 * feature (F1). Until then this passes requests through unchanged.
 */
export const createClient = (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request });

  const { supabaseUrl, supabaseKey } = getPublicEnv();
  createServerClient(supabaseUrl, supabaseKey, {
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

  return supabaseResponse;
};
