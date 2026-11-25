import { type NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db/server";
import { parseDisplayName } from "@/lib/profile/displayName";
import { updateProfile } from "@/lib/profile/updateProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(reason: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, reason }, { status });
}

/** PATCH /api/profile: change the signed-in user's display name. */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  // 1. Validate input.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("invalid_body", 400);
  }
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "displayName")
  ) {
    return fail("invalid_body", 400);
  }
  const parsed = parseDisplayName(
    (body as Record<string, unknown>).displayName,
  );
  if (!parsed.ok) {
    return fail(parsed.reason, 400);
  }

  try {
    // 2. Authenticate. Users can only ever edit their own profile (id from claims).
    const user = await getSessionUser();
    if (user === null) {
      return fail("unauthenticated", 401);
    }
    // 3. One transaction.
    const profile = await withTransaction((tx) =>
      updateProfile(tx, user.id, parsed.value),
    );
    if (profile === null) {
      return fail("profile_not_found", 404);
    }
    return NextResponse.json({
      ok: true,
      profile: { displayName: profile.displayName },
    });
  } catch {
    return fail("internal_error", 500);
  }
}
