import { notFound } from "next/navigation";
import { isDevToolsEnabled } from "@/lib/env";
import { Gallery } from "./Gallery";

export const dynamic = "force-dynamic";

/** Component gallery. 404 unless ENABLE_DEV_TOOLS=1. */
export default function ComponentsPage() {
  if (!isDevToolsEnabled()) {
    notFound();
  }
  return <Gallery />;
}
