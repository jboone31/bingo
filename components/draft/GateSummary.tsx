import styles from "./DraftSetup.module.css";
import { gateText, timerText } from "./gateText";

/** Read-only draft setup for every member: groups, timer and the pool gate. */
export function GateSummary({
  members,
  groups,
  pickSeconds,
  pool,
}: {
  members: number;
  groups: number;
  pickSeconds: number;
  pool: number;
}) {
  const gate = gateText({ members, groups, pool });
  return (
    <div className={styles.gate}>
      <p className={styles.line}>
        {groups} {groups === 1 ? "group" : "groups"} · {timerText(pickSeconds)}
      </p>
      <p className={styles.line}>{gate.pool}</p>
      {gate.problem ? <p className={styles.problem}>{gate.problem}</p> : null}
    </div>
  );
}
