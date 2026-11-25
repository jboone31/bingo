import { Badge } from "@/components/ui/Badge";
import { displayCategory, displaySubmitter } from "@/lib/pool/fields";
import type { SubmissionRow } from "@/lib/pool/read";
import styles from "./SubmissionList.module.css";
import { QueueToggle } from "@/components/queue/QueueToggle";
import { SubmissionActions } from "./SubmissionActions";

/**
 * The pool as cards, so it reads well at phone width. The admin gets Edit and
 * Delete on every row while the league is pre_draft.
 */
export function SubmissionList({
  leagueId,
  items,
  canEdit,
  queuedIds,
}: {
  leagueId: string;
  items: readonly SubmissionRow[];
  canEdit: boolean;
  /** When given, each row gets a queue button reflecting whether it is queued. */
  queuedIds?: ReadonlySet<string>;
}) {
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.card}>
          <div className={styles.body}>
            <p className={styles.text}>{item.text}</p>
            <p className={styles.meta}>
              <span>by {displaySubmitter(item.submitter)}</span>
              <Badge tone={item.category ? "info" : "neutral"}>
                {displayCategory(item.category)}
              </Badge>
            </p>
          </div>
          <div className={styles.controls}>
            {queuedIds ? (
              <QueueToggle
                leagueId={leagueId}
                submissionId={item.id}
                queued={queuedIds.has(item.id)}
              />
            ) : null}
            {canEdit ? (
              <SubmissionActions leagueId={leagueId} submission={item} />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
