"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { localInputToIso } from "@/lib/format/dateTime";
import { reasonMessage } from "@/lib/leagues/messages";
import { LEAGUE_NAME_MAX } from "@/lib/leagues/name";
import styles from "./Form.module.css";

export function CreateLeagueForm() {
  const router = useRouter();
  const toast = useToast();
  // One id per form, so a double submit returns the same league.
  const [requestId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState("");
  const [draftLocal, setDraftLocal] = useState("");
  const [errors, setErrors] = useState<{ name?: string; draftAt?: string }>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draftAt = draftLocal === "" ? undefined : localInputToIso(draftLocal);
    if (draftAt === null) {
      setErrors({ draftAt: reasonMessage("invalid_draft_at") });
      return;
    }
    setPending(true);
    setErrors({});
    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, draftAt, requestId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reason?: string;
        league?: { id: string };
      };
      if (res.ok && data.league) {
        router.push(`/leagues/${data.league.id}`);
        return;
      }
      if (data.reason === "invalid_name") {
        setErrors({ name: reasonMessage(data.reason) });
      } else if (data.reason === "invalid_draft_at") {
        setErrors({ draftAt: reasonMessage(data.reason) });
      } else {
        toast.show(reasonMessage(data.reason), "danger");
      }
    } catch {
      toast.show(reasonMessage(undefined), "danger");
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form}>
      <TextField
        label="League name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={LEAGUE_NAME_MAX * 2}
        autoComplete="off"
        error={errors.name}
      />
      <TextField
        label="Draft date (optional)"
        type="datetime-local"
        value={draftLocal}
        onChange={(e) => setDraftLocal(e.target.value)}
        hint="Shown to everyone in their own time zone."
        error={errors.draftAt}
      />
      <div>
        <Button type="submit" loading={pending}>
          Create league
        </Button>
      </div>
    </form>
  );
}
