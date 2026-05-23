import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

let container: StartedPostgreSqlContainer | undefined;

/**
 * Vitest globalSetup: starts an isolated Postgres container, applies the
 * Drizzle migrations once, and points `DATABASE_URL` at it. Workers inherit
 * the env var when they fork.
 */
export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer("postgres:17-alpine")
    .withDatabase("test")
    .withUsername("test")
    .withPassword("test")
    .start();

  const connectionString = container.getConnectionUri();
  process.env.DATABASE_URL = connectionString;

  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
