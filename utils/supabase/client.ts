import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env";

/** Browser Supabase client (RLS-scoped reads and Realtime subscriptions). */
export const createClient = () => {
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  return createBrowserClient(supabaseUrl, supabaseKey);
};
