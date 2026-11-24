import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for the default (hermetic, offline) test run.
 *
 * Unit and fast-check property tests live next to the code they cover and are
 * discovered by the `include` globs. Node is the default environment because
 * domain logic is framework-free; component tests opt into jsdom with a
 * `// @vitest-environment jsdom` comment. Live-database suites live in
 * `test/integration/` and run only via `npm run test:integration`.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Mirror the `@/*` -> `./*` alias from tsconfig.json.
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` throws outside a Next.js server build; neutralize it so
      // server modules can be unit tested.
      "server-only": fileURLToPath(
        new URL("./vitest.stub.server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "test/integration/**",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
