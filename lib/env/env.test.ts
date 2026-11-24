import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CRON_SECRET_VAR,
  DB_URL_VAR,
  MissingEnvError,
  SERVICE_ROLE_KEY_VAR,
  SUPABASE_ANON_KEY_VAR,
  SUPABASE_PUBLISHABLE_KEY_VAR,
  SUPABASE_URL_VAR,
  requireCronSecret,
  requireServerDbUrl,
  requireServiceRoleKey,
  resolvePublicEnv,
} from "./index";

/** A non-blank string with no surrounding whitespace. */
const value = fc.stringMatching(/^[A-Za-z0-9:/._-]{1,40}$/);
/** Strings that count as "not set": undefined, empty, or whitespace only. */
const blank = fc.constantFrom(undefined, "", "   ", "\t\n");

describe("resolvePublicEnv", () => {
  it("returns the url and publishable key", () => {
    expect(
      resolvePublicEnv({ url: "https://x.supabase.co", publishableKey: "pk" }),
    ).toEqual({ supabaseUrl: "https://x.supabase.co", supabaseKey: "pk" });
  });

  it("falls back to the anon key name", () => {
    expect(
      resolvePublicEnv({ url: "https://x.supabase.co", anonKey: "anon" })
        .supabaseKey,
    ).toBe("anon");
  });

  it("prefers the publishable key when both are set", () => {
    expect(
      resolvePublicEnv({
        url: "https://x.supabase.co",
        publishableKey: "pk",
        anonKey: "anon",
      }).supabaseKey,
    ).toBe("pk");
  });

  it("reports every missing variable at once", () => {
    try {
      resolvePublicEnv({});
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MissingEnvError);
      const message = (error as MissingEnvError).message;
      expect(message).toContain(SUPABASE_URL_VAR);
      expect(message).toContain(SUPABASE_PUBLISHABLE_KEY_VAR);
      expect(message).toContain(SUPABASE_ANON_KEY_VAR);
    }
  });

  it("property: blank url or key always fails, naming the blank one", () => {
    fc.assert(
      fc.property(blank, blank, blank, (url, publishableKey, anonKey) => {
        expect(() =>
          resolvePublicEnv({ url, publishableKey, anonKey }),
        ).toThrow(MissingEnvError);
      }),
      { numRuns: 100 },
    );
  });

  it("property: non-blank url and key always succeed and are trimmed", () => {
    fc.assert(
      fc.property(value, value, (url, key) => {
        const env = resolvePublicEnv({
          url: `  ${url}  `,
          publishableKey: ` ${key} `,
        });
        expect(env).toEqual({ supabaseUrl: url, supabaseKey: key });
      }),
      { numRuns: 100 },
    );
  });
});

describe("server variables", () => {
  const cases = [
    ["requireServerDbUrl", requireServerDbUrl, DB_URL_VAR],
    ["requireServiceRoleKey", requireServiceRoleKey, SERVICE_ROLE_KEY_VAR],
    ["requireCronSecret", requireCronSecret, CRON_SECRET_VAR],
  ] as const;

  for (const [name, fn, variable] of cases) {
    it(`${name} returns the trimmed value`, () => {
      expect(fn({ [variable]: "  secret  " })).toBe("secret");
    });

    it(`${name} throws naming ${variable} when missing or blank`, () => {
      for (const missing of [undefined, "", "   "]) {
        expect(() => fn({ [variable]: missing })).toThrow(variable);
      }
    });
  }
});
