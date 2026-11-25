import "server-only";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { isDevToolsEnabled } from "@/lib/env";

/** Dev routes call this first. Off means a plain 404 with no other effect. */
export function assertDevTools(): void {
  if (!isDevToolsEnabled()) {
    throw new ApiError("not_found", 404);
  }
}

/** Dev pages call this first. Off means the not-found page. */
export function assertDevToolsPage(): void {
  if (!isDevToolsEnabled()) {
    notFound();
  }
}
