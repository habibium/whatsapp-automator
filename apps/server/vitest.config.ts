import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./test/setup/global.ts"],
    environment: "node",
    // Run test files serially so they share one Postgres container without races.
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      // Anything sensitive is a placeholder — only the dev/CI container sees it.
      BETTER_AUTH_SECRET: "test-secret-must-be-at-least-32-characters-long-xx",
      BETTER_AUTH_URL: "http://localhost:3000",
      APP_URL: "http://localhost:3000",
      ENCRYPTION_KEY: "0".repeat(64),
      PORT: "3001"
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/app-type.ts"]
    }
  }
});
