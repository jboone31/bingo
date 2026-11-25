import { GoogleSignInButton } from "@/components/GoogleSignInButton";
import { safeNext } from "@/lib/auth/redirect";

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
    <main>
      <h1>Sign in</h1>
      {message ? <p role="alert">{message}</p> : null}
      <GoogleSignInButton next={safeNext(next)} />
    </main>
  );
}
