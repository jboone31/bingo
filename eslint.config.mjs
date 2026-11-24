import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

/**
 * ESLint flat config.
 *
 * - `eslint-config-next/core-web-vitals`: Next.js + React + React Hooks rules.
 * - `eslint-config-next/typescript`: typescript-eslint rules.
 * - `eslint-config-prettier/flat`: disables rules that conflict with Prettier,
 *   so formatting is owned solely by Prettier.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  // `lib/**` is framework-free domain logic with no React, so the React Hooks
  // rules do not apply. Underscore-prefixed unused args are allowed for
  // design-mandated signatures.
  {
    files: ["lib/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;
