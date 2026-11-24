import { createServerClient } from "@supabase/ssr";
import type { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env";

/** Server Supabase client bound to the request's cookies. */
export const createClient = (
  cookieStore: Awaited<ReturnType<typeof cookies>>,
) => {
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, which cannot set cookies. Safe to
          // ignore while middleware refreshes the session.
        }
      },
    },
  });
};
