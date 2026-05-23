import { count, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { type Delivery, type NewDelivery, delivery } from "../schema";

export type DeliveryInsert = Omit<NewDelivery, "id" | "createdAt" | "sentAt" | "status" | "error">;

/** A page of a user's delivery history, newest first, with a total count. */
export async function listDeliveries(
  userId: string,
  page: { limit: number; offset: number }
): Promise<{ items: Delivery[]; total: number }> {
  const [items, [totals]] = await Promise.all([
    db
      .select()
      .from(delivery)
      .where(eq(delivery.userId, userId))
      .orderBy(desc(delivery.createdAt))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ value: count() }).from(delivery).where(eq(delivery.userId, userId))
  ]);
  return { items, total: totals?.value ?? 0 };
}

/** Creates a delivery record in the `pending` state. */
export async function createDelivery(data: DeliveryInsert): Promise<Delivery> {
  const [row] = await db.insert(delivery).values(data).returning();
  return row!;
}

export async function markDeliverySent(id: string): Promise<void> {
  await db
    .update(delivery)
    .set({ status: "sent", sentAt: new Date(), error: null })
    .where(eq(delivery.id, id));
}

export async function markDeliveryFailed(id: string, error: string): Promise<void> {
  await db
    .update(delivery)
    .set({ status: "failed", error: error.slice(0, 1000) })
    .where(eq(delivery.id, id));
}
