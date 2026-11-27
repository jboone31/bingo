import { Badge } from "@/components/ui/Badge";
import type { GroupStatus } from "@/lib/draft/read";
import { Countdown } from "./Countdown";
import styles from "./DraftSetup.module.css";

/**
 * Each group's place in the draft: round and pick, who is on the clock with a
 * countdown, and the latest picks. The viewer's group comes first. Read only (F8
 * builds the draft room).
 */
export function DraftStatus({
  leagueId,
  groups,
  viewerId,
  completed,
}: {
  leagueId: string;
  groups: readonly GroupStatus[];
  viewerId: string;
  completed: boolean;
}) {
  if (completed) {
    return <p className={styles.line}>The draft is complete.</p>;
  }
  const mine = (g: GroupStatus) => g.memberIds.includes(viewerId);
  const ordered = [...groups].sort(
    (a, b) => Number(mine(b)) - Number(mine(a)) || a.number - b.number,
  );
  return (
    <div className={styles.groups}>
      {ordered.map((g) => (
        <section key={g.number} className={styles.group}>
          <h3 className={styles.groupTitle}>
            Group {g.number}
            {mine(g) ? <Badge tone="accent">Your group</Badge> : null}
          </h3>
          {g.finished ? (
            <p className={styles.line}>Finished.</p>
          ) : (
            <>
              <p className={styles.line}>
                Round {g.round} · pick {g.pickNumber} of {g.totalPicks}
              </p>
              <p className={styles.line}>
                On the clock:{" "}
                <strong>
                  {g.onClock?.displayName ?? "Nobody"}
                  {g.onClock?.userId === viewerId ? " (you)" : ""}
                </strong>{" "}
                {g.deadline ? (
                  <Countdown leagueId={leagueId} deadline={g.deadline} />
                ) : null}
              </p>
            </>
          )}
          {g.recent.length > 0 ? (
            <ol
              className={styles.order}
              aria-label={`Group ${g.number} latest picks`}
            >
              {g.recent.map((p) => (
                <li key={p.pickNumber}>
                  {p.pickNumber}. {p.displayName}: {p.text}
                  {p.auto ? " (auto)" : ""}
                </li>
              ))}
            </ol>
          ) : (
            <p className={styles.line}>No picks yet.</p>
          )}
        </section>
      ))}
    </div>
  );
}
