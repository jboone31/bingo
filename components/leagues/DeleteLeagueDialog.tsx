"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { reasonMessage } from "@/lib/leagues/messages";
import { namesMatch } from "@/lib/leagues/rules";
import styles from "./ConfirmAction.module.css";

/** Delete needs the league name typed exactly. */
export function DeleteLeagueDialog({
  leagueId,
  leagueName,
}: {
  leagueId: string;
  leagueName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const matches = namesMatch(typed, leagueName);

  async function remove() {
    setPending(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmName: typed }),
      });
      const data = (await res.json().catch(() => ({}))) as { reason?: unknown };
      if (!res.ok) {
        toast.show(reasonMessage(data.reason), "danger");
        return;
      }
      toast.show("League deleted.", "success");
      setOpen(false);
      router.push("/");
      router.refresh();
    } catch {
      toast.show(reasonMessage(undefined), "danger");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>
        Delete league
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Delete this league?"
      >
        <p>
          This removes the league and all of its players. It cannot be undone.
        </p>
        <p>
          To confirm, type the league name: <strong>{leagueName}</strong>
        </p>
        <TextField
          label="League name"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
        />
        <div className={styles.actions}>
          <Button
            variant="danger"
            disabled={!matches}
            loading={pending}
            onClick={remove}
          >
            Delete forever
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>
    </>
  );
}
