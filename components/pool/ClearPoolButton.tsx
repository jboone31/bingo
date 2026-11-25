"use client";

import { ConfirmAction } from "@/components/leagues/ConfirmAction";

/** Delete every submission, after confirming. Undoes a mistaken upload. */
export function ClearPoolButton({
  leagueId,
  count,
}: {
  leagueId: string;
  count: number;
}) {
  return (
    <ConfirmAction
      label="Clear pool"
      variant="danger"
      title="Clear the whole pool?"
      confirmLabel="Delete all"
      disabled={count === 0}
      request={{
        url: `/api/leagues/${leagueId}/submissions`,
        method: "DELETE",
        body: { all: true },
      }}
      after={{ kind: "refresh" }}
      successMessage="Pool cleared."
    >
      <p>This deletes all {count} squares in the pool. It cannot be undone.</p>
    </ConfirmAction>
  );
}
