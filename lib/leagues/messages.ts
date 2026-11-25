/** Player-facing text for the `reason` values the league routes return. */
const MESSAGES: Record<string, string> = {
  invalid_name: "Enter a name of 1 to 60 characters.",
  invalid_draft_at: "Enter a valid date and time, or leave it empty.",
  invalid_code: "That code is not valid. Check it and try again.",
  invalid_body: "Something was wrong with that request.",
  league_not_found: "We could not find that league.",
  league_not_pre_draft: "That league's draft has already started.",
  league_full: "That league is full.",
  not_admin: "Only the league admin can do that.",
  admin_cannot_leave:
    "The admin cannot leave. Transfer admin or delete the league.",
  cannot_remove_self:
    "You cannot remove yourself. Use Leave or Transfer admin.",
  target_not_member: "That person is not in the league.",
  confirmation_mismatch: "The name you typed does not match.",
  unauthenticated: "Please sign in again.",
};

const FALLBACK = "Something went wrong. Please try again.";

/** Text for a route failure reason. Unknown reasons get a generic message. */
export function reasonMessage(reason: unknown): string {
  return typeof reason === "string" && reason in MESSAGES
    ? MESSAGES[reason]
    : FALLBACK;
}
