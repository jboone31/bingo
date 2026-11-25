"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { DISPLAY_NAME_MAX } from "@/lib/profile/displayName";

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (res.ok) {
        toast.show("Display name saved.", "success");
        router.refresh();
      } else if (res.status === 400) {
        setError(`Enter a name of 1 to ${DISPLAY_NAME_MAX} characters.`);
      } else {
        toast.show("Could not save. Try again.", "danger");
      }
    } catch {
      toast.show("Could not save. Try again.", "danger");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <TextField
        label="Display name"
        name="displayName"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="nickname"
        hint="Shown to other players in your leagues."
        error={error}
      />
      <p>
        <Button type="submit" loading={saving}>
          Save
        </Button>
      </p>
    </form>
  );
}
