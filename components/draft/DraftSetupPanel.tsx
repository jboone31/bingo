"use client";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ConfirmAction } from "@/components/leagues/ConfirmAction";
import formStyles from "@/components/leagues/Form.module.css";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import {
  formatSeconds,
  parseGroupCount,
  parsePickSeconds,
  GROUP_COUNT,
  PICK_SECONDS,
} from "@/lib/draft/settings";
import { reasonMessage } from "@/lib/leagues/messages";
import styles from "./DraftSetup.module.css";
import { gateText, timerText } from "./gateText";

/**
 * The admin's draft setup: group count and pick timer, the start gate updated as the
 * group count is typed, and the Start button with its confirmation. Start waits until
 * the shown values are saved, so the admin confirms exactly what the server checks.
 */
export function DraftSetupPanel({
  leagueId,
  members,
  pool,
  groupCount,
  pickSeconds,
}: {
  leagueId: string;
  members: number;
  pool: number;
  groupCount: number;
  pickSeconds: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [groupsText, setGroupsText] = useState(String(groupCount));
  const [secondsText, setSecondsText] = useState(String(pickSeconds));
  const [errors, setErrors] = useState<{ groups?: string; seconds?: string }>(
    {},
  );
  const [pending, setPending] = useState(false);

  const groups = parseGroupCount(Number(groupsText));
  const seconds = parsePickSeconds(Number(secondsText));
  const shownGroups = groups.ok ? groups.value : groupCount;
  const dirty =
    groupsText.trim() !== String(groupCount) ||
    secondsText.trim() !== String(pickSeconds);
  const gate = gateText({ members, groups: shownGroups, pool });
  const savedGate = gateText({ members, groups: groupCount, pool });

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!groups.ok || groupsText.trim() === "") {
      next.groups = reasonMessage("invalid_group_count");
    }
    if (!seconds.ok || secondsText.trim() === "") {
      next.seconds = reasonMessage("invalid_pick_seconds");
    }
    setErrors(next);
    if (next.groups || next.seconds || !groups.ok || !seconds.ok) return;
    const body: Record<string, number> = {};
    if (groups.value !== groupCount) body.groupCount = groups.value;
    if (seconds.value !== pickSeconds) body.pickSeconds = seconds.value;
    if (Object.keys(body).length === 0) return;
    setPending(true);
    try {
      const res = await fetch(`/api/leagues/${leagueId}/draft-settings`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { reason?: string };
      if (res.ok) {
        toast.show("Draft settings saved.", "success");
        router.refresh();
      } else if (data.reason === "invalid_group_count") {
        setErrors({ groups: reasonMessage(data.reason) });
      } else if (data.reason === "invalid_pick_seconds") {
        setErrors({ seconds: reasonMessage(data.reason) });
      } else {
        toast.show(reasonMessage(data.reason), "danger");
      }
    } catch {
      toast.show(reasonMessage(undefined), "danger");
    } finally {
      setPending(false);
    }
  }

  const startBlocked = dirty
    ? "Save your changes before starting."
    : savedGate.problem;

  return (
    <div className={styles.stack}>
      <form onSubmit={onSave} noValidate className={formStyles.form}>
        <div className={styles.fields}>
          <TextField
            label="Groups"
            type="number"
            inputMode="numeric"
            min={GROUP_COUNT.min}
            max={GROUP_COUNT.max}
            step={1}
            value={groupsText}
            onChange={(e) => setGroupsText(e.target.value)}
            hint={`${GROUP_COUNT.min} to ${GROUP_COUNT.max}. Players are split at random.`}
            error={errors.groups}
          />
          <TextField
            label="Seconds per pick"
            type="number"
            inputMode="numeric"
            min={PICK_SECONDS.min}
            max={PICK_SECONDS.max}
            step={1}
            value={secondsText}
            onChange={(e) => setSecondsText(e.target.value)}
            hint={
              seconds.ok
                ? `${formatSeconds(seconds.value)}. ${PICK_SECONDS.min} to ${PICK_SECONDS.max} seconds.`
                : `${PICK_SECONDS.min} to ${PICK_SECONDS.max} seconds.`
            }
            error={errors.seconds}
          />
        </div>
        <div>
          <Button type="submit" loading={pending} disabled={!dirty}>
            Save settings
          </Button>
        </div>
      </form>

      <div
        className={styles.gate}
        role="status"
        aria-live="polite"
        aria-label="Start gate"
      >
        <p className={styles.line}>
          {members} {members === 1 ? "player" : "players"}
          {gate.groups ? ` · ${gate.groups}` : ""}
        </p>
        <p className={styles.line}>{gate.pool}</p>
        {gate.problem ? <p className={styles.problem}>{gate.problem}</p> : null}
      </div>

      <div className={styles.stack}>
        <div>
          <ConfirmAction
            label="Start the draft"
            variant="primary"
            size="lg"
            title="Start the draft?"
            confirmLabel="Start draft"
            disabled={startBlocked !== null}
            refreshOnError
            request={{
              url: `/api/leagues/${leagueId}/start`,
              method: "POST",
              body: { expected: { members, groupCount } },
            }}
            after={{ kind: "refresh" }}
            successMessage="The draft has started."
          >
            <ul className={styles.summary}>
              <li>
                {members} {members === 1 ? "player" : "players"} in{" "}
                {savedGate.groups}
              </li>
              <li>{timerText(pickSeconds)}</li>
              <li>{savedGate.pool}</li>
            </ul>
            <p>
              Nobody can join, leave or edit the pool after this. This cannot be
              undone.
            </p>
          </ConfirmAction>
        </div>
        {startBlocked ? <p className={styles.problem}>{startBlocked}</p> : null}
      </div>
    </div>
  );
}
