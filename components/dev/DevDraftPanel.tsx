"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import styles from "./DevTools.module.css";

type Action = "expire" | "bots_on" | "bots_off";

/** Dev only, seed leagues only: expire the running turns, and seed-player bots. */
export function DevDraftPanel({
  leagueId,
  bots,
}: {
  leagueId: string;
  bots: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<Action | null>(null);

  async function run(action: Action) {
    setBusy(action);
    try {
      const res = await fetch("/api/dev/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leagueId, action }),
      });
      const data = (await res.json().catch(() => ({}))) as { picks?: number };
      if (res.ok) {
        toast.show(`Done. ${data.picks ?? 0} auto-pick(s).`, "success");
        router.refresh();
      } else {
        toast.show("That did not work.", "danger");
      }
    } catch {
      toast.show("That did not work.", "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={styles.stack}>
      <div className={styles.row}>
        <Button
          variant="secondary"
          loading={busy === "expire"}
          disabled={busy !== null}
          onClick={() => run("expire")}
        >
          Expire current turns
        </Button>
        <Button
          variant="secondary"
          loading={busy === "bots_on" || busy === "bots_off"}
          disabled={busy !== null}
          onClick={() => run(bots ? "bots_off" : "bots_on")}
        >
          {bots ? "Bots off" : "Bots on"}
        </Button>
      </div>
      <p className={styles.muted}>
        Bots{" "}
        {bots
          ? "are on: seed players pick from their queues at once."
          : "are off."}
      </p>
    </div>
  );
}
