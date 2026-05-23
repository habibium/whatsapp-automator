import { migrate } from "drizzle-orm/node-postgres/migrator";
import { logger } from "../logger";
import { db } from "./client";

/**
 * Applies pending SQL migrations from the `drizzle/` folder.
 * Called on server boot so a fresh database is always schema-current.
 * Resolved relative to the process working directory (the server package root).
 */
export async function runMigrations(): Promise<void> {
  logger.info("Applying database migrations…");
  await migrate(db, { migrationsFolder: "drizzle" });
  logger.info("Database migrations applied");
}
