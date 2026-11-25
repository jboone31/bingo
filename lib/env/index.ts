/**
 * Environment loading and validation.
 *
 * Every variable is validated on demand, and a failure names every offending
 * variable at once so a misconfigured deployment is fixed in one pass.
 *
 * Public variables (`NEXT_PUBLIC_*`) MUST be read with literal
 * `process.env.NEXT_PUBLIC_X` access (see {@link getPublicEnv}) because Next.js
 * only inlines them into the browser bundle when the full name appears in
 * source. Do not replace those reads with dynamic lookups.
 */

export const SUPABASE_URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
export const SUPABASE_PUBLISHABLE_KEY_VAR =
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
/** Older name for the same key; accepted as a fallback. */
export const SUPABASE_ANON_KEY_VAR = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
export const SERVICE_ROLE_KEY_VAR = "SUPABASE_SERVICE_ROLE_KEY";
export const DB_URL_VAR = "SUPABASE_DB_URL";
export const CRON_SECRET_VAR = "CRON_SECRET";
export const DEV_TOOLS_VAR = "ENABLE_DEV_TOOLS";

/** A raw environment source (`process.env` or a test double). */
export type EnvSource = Readonly<Record<string, string | undefined>>;

/** Thrown when one or more required variables are missing or blank. */
export class MissingEnvError extends Error {
  readonly names: readonly string[];

  constructor(names: readonly string[]) {
    super(
      `Missing or empty environment variable(s): ${names.join(", ")}. ` +
        "See .env.example for the full list.",
    );
    this.name = "MissingEnvError";
    this.names = names;
  }
}

/** The value if it is a non-blank string, else `undefined`. */
function nonBlank(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export interface PublicEnv {
  readonly supabaseUrl: string;
  readonly supabaseKey: string;
}

/**
 * Validate the browser-safe Supabase settings from already-read values.
 * The publishable key wins; the anon key name is the fallback.
 */
export function resolvePublicEnv(values: {
  readonly url?: string;
  readonly publishableKey?: string;
  readonly anonKey?: string;
}): PublicEnv {
  const supabaseUrl = nonBlank(values.url);
  const supabaseKey =
    nonBlank(values.publishableKey) ?? nonBlank(values.anonKey);

  const missing: string[] = [];
  if (supabaseUrl === undefined) {
    missing.push(SUPABASE_URL_VAR);
  }
  if (supabaseKey === undefined) {
    missing.push(
      `${SUPABASE_PUBLISHABLE_KEY_VAR} (or ${SUPABASE_ANON_KEY_VAR})`,
    );
  }
  if (supabaseUrl === undefined || supabaseKey === undefined) {
    throw new MissingEnvError(missing);
  }
  return { supabaseUrl, supabaseKey };
}

/**
 * The browser-safe Supabase URL and key. Safe to call from client and server
 * code. Uses literal `process.env.NEXT_PUBLIC_*` reads so Next.js inlines them.
 */
export function getPublicEnv(): PublicEnv {
  return resolvePublicEnv({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

/** Read one required server-only variable, or throw {@link MissingEnvError}. */
function requireServerVar(name: string, source: EnvSource): string {
  const value = nonBlank(source[name]);
  if (value === undefined) {
    throw new MissingEnvError([name]);
  }
  return value;
}

/**
 * The direct Postgres connection string used for transaction-capable server
 * writes. Server-only. Validated on first use so DB-free paths still boot.
 */
export function requireServerDbUrl(source: EnvSource = process.env): string {
  return requireServerVar(DB_URL_VAR, source);
}

/** The Supabase service-role key. Server-only; bypasses RLS. */
export function requireServiceRoleKey(source: EnvSource = process.env): string {
  return requireServerVar(SERVICE_ROLE_KEY_VAR, source);
}

/** The shared secret that protects cron/maintenance routes. Server-only. */
export function requireCronSecret(source: EnvSource = process.env): string {
  return requireServerVar(CRON_SECRET_VAR, source);
}

/**
 * True only when `ENABLE_DEV_TOOLS=1` and Vercel does not report the environment as
 * `production`. Two independent checks: setting the flag by mistake on Production
 * still leaves the tools off. Gates the component gallery, seed scenarios and "act
 * as".
 */
export function isDevToolsEnabled(source: EnvSource = process.env): boolean {
  return (
    source[DEV_TOOLS_VAR]?.trim() === "1" && source.VERCEL_ENV !== "production"
  );
}
