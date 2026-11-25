import { DevTools } from "@/components/dev/DevTools";
import { PageHeader } from "@/components/ui/PageHeader";
import { assertDevToolsPage } from "@/lib/dev/gate";
import { listSeedUsers } from "@/lib/dev/seedUsers";

export const dynamic = "force-dynamic";

/** Dev hub. 404 unless dev tools are enabled. */
export default async function DevPage() {
  assertDevToolsPage();
  const users = await listSeedUsers();
  return (
    <>
      <PageHeader
        title="Dev tools"
        subtitle="Seed scenarios and fake players. Local use only."
      />
      <DevTools
        seedUsers={users.map((u) => ({ id: u.id, displayName: u.displayName }))}
      />
    </>
  );
}
