import { LeagueCard } from "@/components/leagues/LeagueCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSessionUser } from "@/lib/auth/session";
import { listMyLeagues } from "@/lib/leagues/read";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getSessionUser();
  const leagues = user ? await listMyLeagues(user.id) : [];
  return (
    <>
      <PageHeader
        title="My leagues"
        actions={
          leagues.length > 0 ? (
            <>
              <ButtonLink href="/leagues/join" variant="secondary">
                Join
              </ButtonLink>
              <ButtonLink href="/leagues/new">Create</ButtonLink>
            </>
          ) : undefined
        }
      />
      {leagues.length === 0 ? (
        <EmptyState
          title="No leagues yet"
          message="Create a league for your group, or join one with a code."
          action={
            <div className={styles.actions}>
              <ButtonLink href="/leagues/new">Create a league</ButtonLink>
              <ButtonLink href="/leagues/join" variant="secondary">
                Join with a code
              </ButtonLink>
            </div>
          }
        />
      ) : (
        <div className={styles.grid}>
          {leagues.map((league) => (
            <LeagueCard key={league.id} league={league} />
          ))}
        </div>
      )}
    </>
  );
}
