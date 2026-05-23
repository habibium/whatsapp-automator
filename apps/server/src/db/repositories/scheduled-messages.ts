import { and, asc, eq, lte } from "drizzle-orm";
import { db } from "../client";
import { type NewScheduledMessage, type ScheduledMessage, scheduledMessage } from "../schema";

export type ScheduledMessageInsert = Omit<
  NewScheduledMessage,
  "id" | "createdAt" | "updatedAt" | "lastRunAt"
>;
export type ScheduledMessagePatch = Partial<Omit<ScheduledMessageInsert, "userId">>;

/** All of a user's scheduled messages, oldest first. */
export function listScheduledMessages(userId: string): Promise<ScheduledMessage[]> {
  return db
    .select()
    .from(scheduledMessage)
    .where(eq(scheduledMessage.userId, userId))
    .orderBy(asc(scheduledMessage.createdAt));
}

/** A single scheduled message, scoped to its owner. */
export async function findScheduledMessage(
  id: string,
  userId: string
): Promise<ScheduledMessage | undefined> {
  const [row] = await db
    .select()
    .from(scheduledMessage)
    .where(and(eq(scheduledMessage.id, id), eq(scheduledMessage.userId, userId)));
  return row;
}

export async function createScheduledMessage(
  data: ScheduledMessageInsert
): Promise<ScheduledMessage> {
  const [row] = await db.insert(scheduledMessage).values(data).returning();
  return row!;
}

export async function updateScheduledMessage(
  id: string,
  userId: string,
  patch: ScheduledMessagePatch
): Promise<ScheduledMessage | undefined> {
  const [row] = await db
    .update(scheduledMessage)
    .set(patch)
    .where(and(eq(scheduledMessage.id, id), eq(scheduledMessage.userId, userId)))
    .returning();
  return row;
}

export async function deleteScheduledMessage(id: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(scheduledMessage)
    .where(and(eq(scheduledMessage.id, id), eq(scheduledMessage.userId, userId)))
    .returning({ id: scheduledMessage.id });
  return rows.length > 0;
}

/** Enabled messages whose next run is now due — drives the scheduler tick. */
export function findDueScheduledMessages(now: Date): Promise<ScheduledMessage[]> {
  return db
    .select()
    .from(scheduledMessage)
    .where(and(eq(scheduledMessage.enabled, true), lte(scheduledMessage.nextRunAt, now)));
}

/** Advances a message after it has fired (recurring) or exhausts it (one-time). */
export async function advanceScheduledMessage(
  id: string,
  update: { nextRunAt: Date | null; lastRunAt: Date; enabled?: boolean }
): Promise<void> {
  await db.update(scheduledMessage).set(update).where(eq(scheduledMessage.id, id));
}
