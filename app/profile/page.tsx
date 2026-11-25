import Link from "next/link";
import { redirect } from "next/navigation";
import { DisplayNameForm } from "@/components/DisplayNameForm";
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
    <main>
      <h1>Profile</h1>
      <DisplayNameForm initialName={displayName ?? ""} />
      <p>
        <Link href="/">Home</Link>
      </p>
    </main>
  );
}
