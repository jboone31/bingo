"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { isoToLocalInput, localInputToIso } from "@/lib/format/dateTime";
import { reasonMessage } from "@/lib/leagues/messages";
import styles from "./Form.module.css";

const subscribe = () => () => {};

/** Admin sets the draft date in their own time zone. Empty clears it. */
export function DraftDateForm({
  leagueId,
  initialDraftAt,
}: {
  leagueId: string;
  initialDraftAt: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  // The viewer's zone is only known in the browser. The server render and the
  // hydration pass use "" (no mismatch); the local value appears right after.
  const saved = useSyncExternalStore(
    subscribe,
    () => (initialDraftAt ? (isoToLocalInput(initialDraftAt) ?? "") : ""),
    () => "",
  );
  const [edited, setEdited] = useState<string | null>(null);
  const value = edited ?? saved;
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draftAt = value === "" ? null : localInputToIso(value);
    if (value !== "" && draftAt === null) {
      setError(reasonMessage("invalid_draft_at"));
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draftAt }),
      });
      const data = (await res.json().catch(() => ({}))) as { reason?: string };
      if (res.ok) {
        toast.show(
          draftAt ? "Draft date saved." : "Draft date cleared.",
          "success",
        );
        router.refresh();
      } else if (data.reason === "invalid_draft_at") {
        setError(reasonMessage(data.reason));
      } else {
        toast.show(reasonMessage(data.reason), "danger");
      }
    } catch {
      toast.show(reasonMessage(undefined), "danger");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form}>
      <TextField
        label="Draft date"
        type="datetime-local"
        value={value}
        onChange={(e) => setEdited(e.target.value)}
        hint="Everyone sees it in their own time zone. Leave empty to clear it."
        error={error}
      />
      <div>
        <Button type="submit" loading={pending}>
          Save date
        </Button>
      </div>
    </form>
  );
}
