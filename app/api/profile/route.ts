import { readJsonObject } from "@/lib/api/body";
import { ApiError } from "@/lib/api/errors";
import { handle } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { withTransaction } from "@/lib/db/server";
import { parseDisplayName } from "@/lib/profile/displayName";
import { updateProfile } from "@/lib/profile/updateProfile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/profile: change the signed-in user's display name. */
export const PATCH = handle({
  parse: async (request) => {
    const body = await readJsonObject(request, ["displayName"]);
    const parsed = parseDisplayName(body.displayName);
    if (!parsed.ok) {
      throw new ApiError(parsed.reason, 400);
    }
    return parsed.value;
  },
  // The id comes from verified claims, so users can only edit their own profile.
  run: async ({ user, input }) => {
    const profile = await withTransaction((tx) =>
      updateProfile(tx, user.id, input),
    );
    if (profile === null) {
      throw new ApiError("profile_not_found", 404);
    }
    return ok({ profile: { displayName: profile.displayName } });
  },
});
