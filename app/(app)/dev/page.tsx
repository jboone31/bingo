import { DevTools } from "@/components/dev/DevTools";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSessionUser } from "@/lib/auth/session";
import { withTransaction } from "@/lib/db/server";
import { assertDevToolsPage } from "@/lib/dev/gate";
import { listMySeedLeagues } from "@/lib/dev/reset";
import { listSeedUsers } from "@/lib/dev/seedUsers";

export const dynamic = "force-dynamic";

/** Dev hub. 404 unless dev tools are enabled. */
export default async function DevPage() {
  assertDevToolsPage();
  const user = await getSessionUser();
  const [users, leagues] = await Promise.all([
    listSeedUsers(),
    user
      ? withTransaction((tx) => listMySeedLeagues(tx, user.id))
      : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader
        title="Dev tools"
        subtitle="Seed scenarios and fake players. Local use only."
      />
      <DevTools
        seedUsers={users.map((u) => ({ id: u.id, displayName: u.displayName }))}
        seedLeagues={leagues}
      />
    </>
  );
}
