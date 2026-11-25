/** Plain POST form so a prefetch or cross-site GET cannot sign anyone out. */
export function SignOutButton() {
  return (
    <form method="post" action="/api/auth/sign-out">
      <button type="submit">Sign out</button>
    </form>
  );
}
