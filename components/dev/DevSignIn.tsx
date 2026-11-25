"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import styles from "./DevTools.module.css";

export interface DevSignInUser {
  readonly id: string;
  readonly displayName: string;
}

/**
 * Sign in as a seed player with no Google redirect. Shown only on the sign-in page
 * when dev tools are enabled and the page is loaded from a local or private address.
 * `next` must already be a safe same-site path.
 */
export function DevSignIn({
  users,
  next,
}: {
  users: readonly DevSignInUser[];
  next: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [userId, setUserId] = useState("");
  const [pending, setPending] = useState(false);

  async function signIn() {
    setPending(true);
    try {
      const res = await fetch("/api/dev/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        router.push(next);
        router.refresh();
        return;
      }
      toast.show("Could not sign in as that player.", "danger");
    } catch {
      toast.show("Could not sign in as that player.", "danger");
    }
    setPending(false);
  }

  return (
    <div className={styles.stack}>
      <p className={styles.muted}>
        Dev only. Skips Google, for testing from a phone on your network.
      </p>
      <Select
        label="Seed player"
        placeholder="Choose a player"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        options={users.map((u) => ({ value: u.id, label: u.displayName }))}
      />
      <div>
        <Button
          variant="secondary"
          disabled={userId === ""}
          loading={pending}
          onClick={signIn}
        >
          Sign in as player
        </Button>
      </div>
    </div>
  );
}
