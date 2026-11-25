import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { Panel } from "@/components/ui/Panel";
import { ErrorState } from "@/components/ui/ErrorState";
import { safeNext } from "@/lib/auth/redirect";
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
  return (
    <div className={styles.card}>
      <h1 className={styles.brand}>Bingo Draft</h1>
      <Panel title="Sign in">
        <div className={styles.stack}>
          {message ? (
            <ErrorState title="Sign-in failed" message={message} />
          ) : null}
          <GoogleSignInButton next={safeNext(next)} />
        </div>
      </Panel>
    </div>
  );
}
