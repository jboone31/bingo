import { JoinLeagueForm } from "@/components/leagues/JoinLeagueForm";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { normalizeJoinCode } from "@/lib/leagues/joinCode";

/**
 * Invite link. It shows a Join button instead of joining on load, so link previews
 * and prefetching cannot add anyone to a league.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = normalizeJoinCode(decodeURIComponent(code));
  if (normalized === null) {
    return (
      <EmptyState
        title="That invite link is not valid"
        message="Ask your league admin for a new link or code."
        action={<ButtonLink href="/leagues/join">Enter a code</ButtonLink>}
      />
    );
  }
  return (
    <>
      <PageHeader
        title="You are invited"
        subtitle="Join the league to start building your queue."
      />
      <Panel>
        <JoinLeagueForm initialCode={normalized} />
      </Panel>
    </>
  );
}
