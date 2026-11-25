"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";
import type { MemberInfo } from "@/lib/leagues/read";
import { ConfirmAction } from "./ConfirmAction";
import styles from "./TransferAdminForm.module.css";

/** Pick another member and hand them admin, after confirming. */
export function TransferAdminForm({
  leagueId,
  candidates,
}: {
  leagueId: string;
  candidates: readonly MemberInfo[];
}) {
  const [userId, setUserId] = useState("");
  const chosen = candidates.find((c) => c.userId === userId);
  return (
    <div className={styles.form}>
      <Select
        label="New admin"
        placeholder={
          candidates.length ? "Choose a player" : "No other players yet"
        }
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        disabled={candidates.length === 0}
        options={candidates.map((c) => ({
          value: c.userId,
          label: c.displayName,
        }))}
      />
      <ConfirmAction
        label="Transfer admin"
        title={`Make ${chosen?.displayName ?? "this player"} the admin?`}
        confirmLabel="Transfer"
        disabled={!chosen}
        request={{
          url: `/api/leagues/${leagueId}/transfer`,
          method: "POST",
          body: { userId },
        }}
        after={{ kind: "go", to: `/leagues/${leagueId}` }}
        successMessage="Admin transferred."
      >
        <p>You will become a regular player and lose access to Settings.</p>
      </ConfirmAction>
    </div>
  );
}
