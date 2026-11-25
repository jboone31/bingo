import { redirect } from "next/navigation";
import { DisplayNameForm } from "@/components/DisplayNameForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { getSessionUser } from "@/lib/auth/session";
import { readOwnDisplayName } from "@/lib/profile/readProfile";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getSessionUser();
  if (user === null) {
    redirect("/sign-in?next=%2Fprofile");
  }
  const displayName = await readOwnDisplayName(user.id);
  return (
    <>
      <PageHeader title="Profile" />
      <Panel title="Display name">
        <DisplayNameForm initialName={displayName ?? ""} />
      </Panel>
    </>
  );
}
