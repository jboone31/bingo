import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { safeNext } from "@/lib/auth/redirect";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/callback: finish Google sign-in and redirect to `next`. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const failure = NextResponse.redirect(
    new URL("/sign-in?error=auth_failed", origin),
  );
  if (!code) {
    return failure;
  }
  try {
    const supabase = createClient(await cookies());
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return failure;
    }
  } catch {
    return failure;
  }
  return NextResponse.redirect(
    new URL(safeNext(searchParams.get("next")), origin),
  );
}
