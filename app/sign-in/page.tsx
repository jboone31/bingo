import { DevSignIn } from "@/components/dev/DevSignIn";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Panel } from "@/components/ui/Panel";
import { ErrorState } from "@/components/ui/ErrorState";
import { safeNext } from "@/lib/auth/redirect";
import { devSignInUsers } from "@/lib/dev/signIn";
import styles from "./page.module.css";

const ERRORS: Record<string, string> = {
  auth_failed: "Sign-in did not complete. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const message = error ? ERRORS[error] : undefined;
  const target = safeNext(next);
  const devUsers = await devSignInUsers();
  return (
    <div className={styles.card}>
      <h1 className={styles.brand}>Bingo Draft</h1>
      <Panel title="Sign in">
        <div className={styles.stack}>
          {message ? (
            <ErrorState title="Sign-in failed" message={message} />
          ) : null}
          <GoogleSignInButton next={target} />
        </div>
      </Panel>
      {devUsers.length > 0 ? (
        <Panel title="Dev sign-in">
          <DevSignIn
            users={devUsers.map((u) => ({
              id: u.id,
              displayName: u.displayName,
            }))}
            next={target}
          />
        </Panel>
      ) : null}
    </div>
  );
}
