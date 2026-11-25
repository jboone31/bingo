"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

/** Starts Google OAuth. `next` must already be a safe same-site path. */
export function GoogleSignInButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function signIn() {
    setPending(true);
    setFailed(false);
    const redirectTo = `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <div>
      <button type="button" onClick={signIn} disabled={pending}>
        Sign in with Google
      </button>
      {failed ? <p role="alert">Could not start sign-in. Try again.</p> : null}
    </div>
  );
}
