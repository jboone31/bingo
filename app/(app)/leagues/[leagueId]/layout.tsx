import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SubNav } from "@/components/shell/SubNav";
import { getSessionUser } from "@/lib/auth/session";
import { getLeague, listMembers } from "@/lib/leagues/read";

export const dynamic = "force-dynamic";

/**
 * Loads the league through RLS. A missing league and a non-member look the same:
 * the not-found page.
 */
export default async function LeagueLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const user = await getSessionUser();
  const league = await getLeague(leagueId);
  if (user === null || league === null) {
    notFound();
  }
  const members = await listMembers(leagueId);
  const isAdmin = members.some(
    (m) => m.userId === user.id && m.role === "admin",
  );
  const items = [
    { href: `/leagues/${leagueId}`, label: "Overview" },
    { href: `/leagues/${leagueId}/pool`, label: "Pool" },
    ...(isAdmin
      ? [{ href: `/leagues/${leagueId}/settings`, label: "Settings" }]
      : []),
  ];
  return (
    <>
      <SubNav label="League" items={items} />
      {children}
    </>
  );
}
