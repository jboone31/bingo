import type { ReactNode } from "react";
import { ServerClockProvider } from "@/components/realtime/ServerClockProvider";
import { AppHeader } from "@/components/shell/AppHeader";
import { PageContainer } from "@/components/shell/PageContainer";
import { getSessionUser } from "@/lib/auth/session";
import { parseSeedEmail } from "@/lib/dev/seedIdentity";
import { isDevToolsEnabled } from "@/lib/env";
import { readOwnDisplayName } from "@/lib/profile/readProfile";

export const dynamic = "force-dynamic";

/** The signed-in frame: header, user menu and a centered content container. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  const name = user ? ((await readOwnDisplayName(user.id)) ?? "Player") : null;
  return (
    <>
      <AppHeader
        displayName={name}
        devActingAs={
          name !== null &&
          isDevToolsEnabled() &&
          parseSeedEmail(user?.email) !== null
            ? name
            : null
        }
      />
      <ServerClockProvider>
        <PageContainer>{children}</PageContainer>
      </ServerClockProvider>
    </>
  );
}
