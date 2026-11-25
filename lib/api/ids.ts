import { ApiError } from "./errors";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A UUID string, or an `invalid_body` error. Returned lowercased. */
export function parseUuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new ApiError("invalid_body", 400);
  }
  return value.toLowerCase();
}
