import { PageContainer } from "@/components/shell/PageContainer";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <PageContainer>
      <EmptyState
        title="Page not found"
        message="That page does not exist, or you do not have access to it."
        action={<ButtonLink href="/">Go home</ButtonLink>}
      />
    </PageContainer>
  );
}
