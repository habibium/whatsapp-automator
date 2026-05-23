import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not load .env automatically — load the repo-root file if present.
if (existsSync("../../.env")) {
  process.loadEnvFile("../../.env");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/whatsapp_scheduler"
  },
  strict: true,
  verbose: true
});
