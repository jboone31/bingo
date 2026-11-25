"use client";

import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatJoinCode } from "@/lib/leagues/joinCode";
import styles from "./InvitePanel.module.css";

/** The join code and invite link with Copy buttons. `code` is the stored form. */
export function InvitePanel({ code }: { code: string }) {
  const toast = useToast();

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(`${what} copied.`, "success");
    } catch {
      toast.show(
        "Could not copy. Select the text and copy it by hand.",
        "danger",
      );
    }
  }

  const link = () => `${window.location.origin}/join/${code}`;

  return (
    <div className={styles.panel}>
      <p className={styles.label}>Join code</p>
      <p className={styles.code}>{formatJoinCode(code)}</p>
      <div className={styles.actions}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => copy(formatJoinCode(code), "Code")}
        >
          Copy code
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => copy(link(), "Invite link")}
        >
          Copy invite link
        </Button>
      </div>
    </div>
  );
}
