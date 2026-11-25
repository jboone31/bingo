import { Badge } from "@/components/ui/Badge";
import { displayCategory, displaySubmitter } from "@/lib/pool/fields";
import type { SubmissionRow } from "@/lib/pool/read";
import styles from "./SubmissionList.module.css";
import { SubmissionActions } from "./SubmissionActions";

/**
 * The pool as cards, so it reads well at phone width. The admin gets Edit and
 * Delete on every row while the league is pre_draft.
 */
export function SubmissionList({
  leagueId,
  items,
  canEdit,
}: {
  leagueId: string;
  items: readonly SubmissionRow[];
  canEdit: boolean;
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
          {canEdit ? (
            <SubmissionActions leagueId={leagueId} submission={item} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
