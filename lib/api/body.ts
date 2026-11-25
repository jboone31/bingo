import type { NextRequest } from "next/server";
import { ApiError } from "./errors";

/**
 * Read a JSON object body and reject anything else: bad JSON, arrays, non-objects,
 * and keys outside `allowedKeys`.
 */
export async function readJsonObject(
  request: NextRequest,
  allowedKeys: readonly string[],
): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("invalid_body", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ApiError("invalid_body", 400);
  }
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    throw new ApiError("invalid_body", 400);
  }
  return body as Record<string, unknown>;
}
