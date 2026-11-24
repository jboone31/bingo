import { type NextRequest } from "next/server";

import { createClient } from "@/utils/supabase/middleware";

/** Next.js 16 `proxy` (formerly `middleware`): runs before every matched request. */
export function proxy(request: NextRequest) {
  return createClient(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
