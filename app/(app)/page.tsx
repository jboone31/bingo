import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Home() {
  return (
    <>
      <PageHeader
        title="Bingo Draft"
        subtitle="Your leagues, all in one place."
      />
      <Panel title="My leagues">
        <EmptyState
          title="No leagues yet"
          message="Creating and joining leagues arrives in the next update."
        />
      </Panel>
    </>
  );
}
