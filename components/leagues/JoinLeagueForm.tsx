"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { reasonMessage } from "@/lib/leagues/messages";
import styles from "./Form.module.css";

/** Enter a join code. `initialCode` prefills it for invite links. */
export function JoinLeagueForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(undefined);
    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reason?: string;
        leagueId?: string;
      };
      if (res.ok && data.leagueId) {
        router.push(`/leagues/${data.leagueId}`);
        return;
      }
      if (
        data.reason === "invalid_code" ||
        data.reason === "league_not_found"
      ) {
        setError(reasonMessage(data.reason));
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
        label="Join code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="K7P2-QX9M"
        error={error}
      />
      <div>
        <Button type="submit" loading={pending}>
          Join league
        </Button>
      </div>
    </form>
  );
}
