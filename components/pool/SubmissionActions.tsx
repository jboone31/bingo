"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ConfirmAction } from "@/components/leagues/ConfirmAction";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { reasonMessage } from "@/lib/leagues/messages";
import type { SubmissionRow } from "@/lib/pool/read";
import styles from "./Pool.module.css";

/** Edit and Delete for one submission (admin, pre_draft). */
export function SubmissionActions({
  leagueId,
  submission,
}: {
  leagueId: string;
  submission: SubmissionRow;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(submission.text);
  const [submitter, setSubmitter] = useState(submission.submitter);
  const [category, setCategory] = useState(submission.category);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function openEditor() {
    setText(submission.text);
    setSubmitter(submission.submitter);
    setCategory(submission.category);
    setErrors({});
    setOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/submissions/${submission.id}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, submitter, category }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { reason?: string };
      if (res.ok) {
        toast.show("Square updated.", "success");
        setOpen(false);
        router.refresh();
      } else if (data.reason === "invalid_text") {
        setErrors({ text: reasonMessage(data.reason) });
      } else if (data.reason === "invalid_submitter") {
        setErrors({ submitter: reasonMessage(data.reason) });
      } else if (data.reason === "invalid_category") {
        setErrors({ category: reasonMessage(data.reason) });
      } else {
        toast.show(reasonMessage(data.reason), "danger");
        setOpen(false);
      }
    } catch {
      toast.show(reasonMessage(undefined), "danger");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.actions}>
      <Button variant="secondary" size="sm" onClick={openEditor}>
        Edit
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit square">
        <form onSubmit={save} noValidate className={styles.form}>
          <TextField
            label="Text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            error={errors.text}
          />
          <TextField
            label="Submitter"
            value={submitter}
            onChange={(e) => setSubmitter(e.target.value)}
            error={errors.submitter}
          />
          <TextField
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            error={errors.category}
          />
          <div className={styles.actions}>
            <Button type="submit" loading={pending}>
              Save
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmAction
        label="Delete"
        variant="danger"
        size="sm"
        title="Delete this square?"
        confirmLabel="Delete"
        request={{
          url: `/api/leagues/${leagueId}/submissions/${submission.id}`,
          method: "DELETE",
        }}
        after={{ kind: "refresh" }}
        successMessage="Square deleted."
      >
        <p>{submission.text}</p>
      </ConfirmAction>
    </div>
  );
}
