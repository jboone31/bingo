"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { reasonMessage } from "@/lib/leagues/messages";

/**
 * Add a square to the caller's queue or take it out. Responds at once, then confirms
 * with the server; if the server refuses, it goes back and says why.
 */
export function QueueToggle({
  leagueId,
  submissionId,
  queued,
}: {
  leagueId: string;
  submissionId: string;
  queued: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  // `shown` leads the server value after a click; it resets when the server value changes.
  const [shown, setShown] = useState<{ base: boolean; value: boolean }>({
    base: queued,
    value: queued,
  });
  const current = shown.base === queued ? shown.value : queued;
  const [pending, setPending] = useState(false);

  async function toggle() {
    const next = !current;
    setShown({ base: queued, value: next });
    setPending(true);
    try {
      const res = await fetch(
        next
          ? `/api/leagues/${leagueId}/queue`
          : `/api/leagues/${leagueId}/queue/${submissionId}`,
        next
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ submissionId }),
            }
          : { method: "DELETE" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          reason?: string;
        };
        setShown({ base: queued, value: !next });
        toast.show(reasonMessage(data.reason), "danger");
        return;
      }
      router.refresh();
    } catch {
      setShown({ base: queued, value: !next });
      toast.show(reasonMessage(undefined), "danger");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant={current ? "secondary" : "primary"}
      size="sm"
      disabled={pending}
      aria-pressed={current}
      onClick={toggle}
    >
      {current ? "Queued ✓" : "Add to queue"}
    </Button>
  );
}
