import { Badge } from "@/components/ui/Badge";
import type { MemberInfo } from "@/lib/leagues/read";
import type { LeagueStatus, MemberRole } from "@/lib/leagues/types";
import { ConfirmAction } from "./ConfirmAction";
import styles from "./MemberList.module.css";

/** Players in a league. The admin gets a Remove action on other rows pre-draft. */
export function MemberList({
  leagueId,
  members,
  viewerId,
  viewerRole,
  status,
}: {
  leagueId: string;
  members: readonly MemberInfo[];
  viewerId: string;
  viewerRole: MemberRole;
  status: LeagueStatus;
}) {
  const canRemove = viewerRole === "admin" && status === "pre_draft";
  return (
    <ul className={styles.list}>
      {members.map((member) => (
        <li key={member.userId} className={styles.row}>
          <span className={styles.name}>
            {member.displayName}
            {member.userId === viewerId ? " (you)" : ""}
          </span>
          {member.role === "admin" ? <Badge tone="accent">Admin</Badge> : null}
          {canRemove && member.userId !== viewerId ? (
            <ConfirmAction
              label="Remove"
              variant="danger"
              size="sm"
              title={`Remove ${member.displayName}?`}
              confirmLabel="Remove"
              request={{
                url: `/api/leagues/${leagueId}/members/${member.userId}`,
                method: "DELETE",
              }}
              after={{ kind: "refresh" }}
              successMessage={`${member.displayName} was removed.`}
            >
              <p>
                They can rejoin with the join code. Regenerate the code in
                Settings if you want to keep them out.
              </p>
            </ConfirmAction>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
