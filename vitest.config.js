import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` is a Next.js convention that throws when imported outside
      // a Server Component module. In Node-based vitest tests we stub it to an
      // empty module so importing server-only files (auth helpers, server
      // actions) works without going through the Next runtime.
      "server-only": fileURLToPath(new URL("./tests/stubs/empty.js", import.meta.url))
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    setupFiles: ["./tests/setup/setup.js"],
    globalSetup: ["./tests/setup/global-setup.js"],
    // Run all test files in a single fork so they share one in-memory MongoDB
    // instance without racing each other's beforeEach/afterEach clearDatabase
    // calls. Per-file isolation is preserved by `clearDatabase` between tests.
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
