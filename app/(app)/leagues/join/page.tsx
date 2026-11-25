import { JoinLeagueForm } from "@/components/leagues/JoinLeagueForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";

export default function JoinLeaguePage() {
  return (
    <>
      <PageHeader
        title="Join a league"
        subtitle="Enter the code your league admin shared."
      />
      <Panel>
        <JoinLeagueForm />
      </Panel>
    </>
  );
}
