import { sql } from "drizzle-orm";
import { db } from "../../src/db/client";
import { user as userTable } from "../../src/db/schema";

/** A deterministic test user that survives across test files. */
export const TEST_USER = {
  id: "test-user-00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  name: "Test User"
} as const;

/** Truncates every application table — FK cascades clear dependent rows. */
export async function resetDb(): Promise<void> {
  await db.execute(sql`TRUNCATE TABLE "user" RESTART IDENTITY CASCADE`);
}

/** Inserts the canonical test user so foreign keys are satisfied. */
export async function seedTestUser(): Promise<void> {
  await db
    .insert(userTable)
    .values({
      id: TEST_USER.id,
      email: TEST_USER.email,
      name: TEST_USER.name,
      emailVerified: true
    })
    .onConflictDoNothing();
}
