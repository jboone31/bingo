import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { Badge } from "@/components/ui/Badge";
import type { LeagueSummary } from "@/lib/leagues/read";
import styles from "./LeagueCard.module.css";
import { STATUS_LABEL, STATUS_TONE } from "./status";

export function LeagueCard({ league }: { league: LeagueSummary }) {
  return (
    <Link href={`/leagues/${league.id}`} className={styles.card}>
      <h2 className={styles.name}>{league.name}</h2>
      <div className={styles.badges}>
        <Badge tone={STATUS_TONE[league.status]}>
          {STATUS_LABEL[league.status]}
        </Badge>
        {league.role === "admin" ? <Badge tone="accent">Admin</Badge> : null}
      </div>
      <p className={styles.meta}>
        {league.memberCount} {league.memberCount === 1 ? "player" : "players"}
      </p>
      <p className={styles.meta}>
        {league.draftAt ? (
          <>
            Draft: <LocalTime iso={league.draftAt} />
          </>
        ) : (
          "Date to be set"
        )}
      </p>
    </Link>
  );
}
