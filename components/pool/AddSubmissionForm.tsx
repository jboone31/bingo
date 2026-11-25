"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { newRequestId } from "@/lib/ids/requestId";
import { reasonMessage } from "@/lib/leagues/messages";
import styles from "./Pool.module.css";

/** Add one square. A request id per attempt makes a double click add it once. */
export function AddSubmissionForm({ leagueId }: { leagueId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [requestId, setRequestId] = useState(() => newRequestId());
  const [text, setText] = useState("");
  const [submitter, setSubmitter] = useState("");
  const [category, setCategory] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    try {
      const res = await fetch(`/api/leagues/${leagueId}/submissions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, submitter, category, requestId }),
      });
      const data = (await res.json().catch(() => ({}))) as { reason?: string };
      if (res.ok) {
        toast.show("Square added.", "success");
        setText("");
        setSubmitter("");
        setCategory("");
        setRequestId(newRequestId());
        router.refresh();
      } else if (data.reason === "invalid_text") {
        setErrors({ text: reasonMessage(data.reason) });
      } else if (data.reason === "invalid_submitter") {
        setErrors({ submitter: reasonMessage(data.reason) });
      } else if (data.reason === "invalid_category") {
        setErrors({ category: reasonMessage(data.reason) });
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
        label="Text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        error={errors.text}
        autoComplete="off"
      />
      <TextField
        label="Submitter"
        value={submitter}
        onChange={(e) => setSubmitter(e.target.value)}
        error={errors.submitter}
        autoComplete="off"
      />
      <TextField
        label="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        error={errors.category}
        autoComplete="off"
      />
      <div>
        <Button type="submit" loading={pending}>
          Add square
        </Button>
      </div>
    </form>
  );
}
