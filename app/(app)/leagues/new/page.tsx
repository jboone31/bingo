import { CreateLeagueForm } from "@/components/leagues/CreateLeagueForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";

export default function NewLeaguePage() {
  return (
    <>
      <PageHeader title="Create a league" />
      <Panel>
        <CreateLeagueForm />
      </Panel>
    </>
  );
}
