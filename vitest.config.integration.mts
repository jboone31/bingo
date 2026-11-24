import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for LIVE integration runs (`npm run test:integration`).
 *
 * Loads `.env.local` first so the suites in `test/integration/` run against the
 * configured Supabase project. The default `npm test` never loads env files and
 * never touches a live backend.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./vitest.stub.server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["test/integration/**/*.test.ts"],
    setupFiles: ["./vitest.setup.integration.ts"],
    // The suites share one live database; run them one at a time.
    fileParallelism: false,
    maxWorkers: 1,
  },
});
