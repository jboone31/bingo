import type { ReactNode } from "react";
import { AppHeader } from "@/components/shell/AppHeader";
import { PageContainer } from "@/components/shell/PageContainer";
import { getSessionUser } from "@/lib/auth/session";
import { readOwnDisplayName } from "@/lib/profile/readProfile";

export const dynamic = "force-dynamic";

/** The signed-in frame: header, user menu and a centered content container. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  const name = user ? ((await readOwnDisplayName(user.id)) ?? "Player") : null;
  return (
    <>
      <AppHeader displayName={name} />
      <PageContainer>{children}</PageContainer>
    </>
  );
}
