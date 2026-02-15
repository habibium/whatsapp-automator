import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({
  path: "../../.env"
});

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgresql://postgres@127.0.0.1/whatsapp_scheduler"
  }
});
