import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";
import { logger } from "../logger";
import * as schema from "./schema";

/** Shared connection pool — used by Drizzle for all application queries. */
export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected database pool error");
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;

/** Verifies the database is reachable. */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch (err) {
    logger.error({ err }, "Database connection check failed");
    return false;
  }
}

/** Closes the connection pool — called during graceful shutdown. */
export async function closeDatabase(): Promise<void> {
  await pool.end();
}
