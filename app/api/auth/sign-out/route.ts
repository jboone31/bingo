import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/sign-out: clear the session. Safe to repeat. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const supabase = createClient(await cookies());
    await supabase.auth.signOut();
  } catch {
    // Signing out when already signed out, or when Supabase is unreachable,
    // still ends at the sign-in page.
  }
  return NextResponse.redirect(
    new URL("/sign-in", request.nextUrl.origin),
    303,
  );
}
