"use client";

import { PageContainer } from "@/components/shell/PageContainer";
import { ButtonLink } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";

export default function GlobalError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <PageContainer>
      <ErrorState
        message="An unexpected error occurred. You can try again or go home."
        onRetry={reset}
      />
      <p>
        <ButtonLink href="/" variant="ghost">
          Go home
        </ButtonLink>
      </p>
    </PageContainer>
  );
}
