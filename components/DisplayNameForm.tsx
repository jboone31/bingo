"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { DISPLAY_NAME_MAX } from "@/lib/profile/displayName";

type Status = "idle" | "saving" | "saved" | "invalid" | "error";

const MESSAGES: Record<Exclude<Status, "idle" | "saving">, string> = {
  saved: "Saved.",
  invalid: `Enter a name of 1 to ${DISPLAY_NAME_MAX} characters.`,
  error: "Could not save. Try again.",
};

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: name }),
      });
      if (res.ok) {
        setStatus("saved");
        router.refresh();
      } else if (res.status === 400) {
        setStatus("invalid");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="displayName">Display name</label>
      <input
        id="displayName"
        name="displayName"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="nickname"
      />
      <button type="submit" disabled={status === "saving"}>
        Save
      </button>
      {status !== "idle" && status !== "saving" ? (
        <p role="status">{MESSAGES[status]}</p>
      ) : null}
    </form>
  );
}
