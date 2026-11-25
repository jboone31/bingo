import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { getSessionUser } from "@/lib/auth/session";
import { readOwnDisplayName } from "@/lib/profile/readProfile";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  const displayName = user ? await readOwnDisplayName(user.id) : null;
  return (
    <main>
      <h1>Bingo Draft</h1>
      <p>Hello, world. The annual bingo draft is coming together.</p>
      {user ? (
        <>
          <p>Signed in as {displayName ?? "Player"}.</p>
          <p>
            <Link href="/profile">Edit profile</Link>
          </p>
          <SignOutButton />
        </>
      ) : null}
    </main>
  );
}
