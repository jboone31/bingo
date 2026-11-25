import { assertDevToolsPage } from "@/lib/dev/gate";
import { Gallery } from "./Gallery";

export const dynamic = "force-dynamic";

/** Component gallery. 404 unless dev tools are enabled. */
export default function ComponentsPage() {
  assertDevToolsPage();
  return <Gallery />;
}
