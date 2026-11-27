import { Badge } from "@/components/ui/Badge";
import type { DraftGroup } from "@/lib/draft/read";
import styles from "./DraftSetup.module.css";

/** Every group in draft order. The viewer's group comes first and is marked. */
export function DraftGroups({
  groups,
  viewerId,
}: {
  groups: readonly DraftGroup[];
  viewerId: string;
}) {
  const mine = (g: DraftGroup) => g.members.some((m) => m.userId === viewerId);
  const ordered = [...groups].sort(
    (a, b) => Number(mine(b)) - Number(mine(a)) || a.number - b.number,
  );
  if (ordered.length === 0) {
    return <p className={styles.line}>The groups are not ready yet.</p>;
  }
  return (
    <div className={styles.groups}>
      {ordered.map((group) => (
        <section key={group.number} className={styles.group}>
          <h3 className={styles.groupTitle}>
            Group {group.number}
            {mine(group) ? <Badge tone="accent">Your group</Badge> : null}
          </h3>
          <ol className={styles.order}>
            {group.members.map((m) => (
              <li key={m.userId}>
                {m.displayName}
                {m.userId === viewerId ? " (you)" : ""}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
