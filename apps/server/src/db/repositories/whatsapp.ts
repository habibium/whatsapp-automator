import type { ConnectionStatus } from "@pkg/shared";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../client";
import { type WhatsappSession, whatsappSession, whatsappSignalKey } from "../schema";

export type WhatsappSessionPatch = {
  creds?: string | null;
  status?: ConnectionStatus;
  phoneNumber?: string | null;
};

export async function getWhatsappSession(userId: string): Promise<WhatsappSession | undefined> {
  const [row] = await db.select().from(whatsappSession).where(eq(whatsappSession.userId, userId));
  return row;
}

/** Inserts or updates a user's WhatsApp session row. */
export async function upsertWhatsappSession(
  userId: string,
  patch: WhatsappSessionPatch
): Promise<void> {
  await db
    .insert(whatsappSession)
    .values({ userId, ...patch })
    .onConflictDoUpdate({
      target: whatsappSession.userId,
      set: { ...patch, updatedAt: new Date() }
    });
}

/** User IDs that have previously paired a device — reconnected on boot. */
export async function listPairedSessionUserIds(): Promise<string[]> {
  const rows = await db
    .select({ userId: whatsappSession.userId })
    .from(whatsappSession)
    .where(isNotNull(whatsappSession.creds));
  return rows.map((row) => row.userId);
}

/** Wipes credentials and Signal keys so the next connect starts a fresh pairing. */
export async function clearWhatsappSession(userId: string): Promise<void> {
  await db.delete(whatsappSignalKey).where(eq(whatsappSignalKey.userId, userId));
  await db
    .update(whatsappSession)
    .set({ creds: null, phoneNumber: null, status: "disconnected", updatedAt: new Date() })
    .where(eq(whatsappSession.userId, userId));
}

// ── Signal protocol keys ─────────────────────────────────────────────

/** Loads requested Signal keys for one category, keyed by their id. */
export async function getSignalKeys(
  userId: string,
  category: string,
  ids: string[]
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ keyId: whatsappSignalKey.keyId, data: whatsappSignalKey.data })
    .from(whatsappSignalKey)
    .where(
      and(
        eq(whatsappSignalKey.userId, userId),
        eq(whatsappSignalKey.category, category),
        inArray(whatsappSignalKey.keyId, ids)
      )
    );
  return new Map(rows.map((row) => [row.keyId, row.data]));
}

/** Batch upserts Signal keys for one category. */
export async function saveSignalKeys(
  userId: string,
  category: string,
  entries: { keyId: string; data: string }[]
): Promise<void> {
  if (entries.length === 0) return;
  await db
    .insert(whatsappSignalKey)
    .values(entries.map((entry) => ({ userId, category, keyId: entry.keyId, data: entry.data })))
    .onConflictDoUpdate({
      target: [whatsappSignalKey.userId, whatsappSignalKey.category, whatsappSignalKey.keyId],
      set: { data: sql`excluded.data` }
    });
}

/** Batch deletes Signal keys for one category. */
export async function deleteSignalKeys(
  userId: string,
  category: string,
  keyIds: string[]
): Promise<void> {
  if (keyIds.length === 0) return;
  await db
    .delete(whatsappSignalKey)
    .where(
      and(
        eq(whatsappSignalKey.userId, userId),
        eq(whatsappSignalKey.category, category),
        inArray(whatsappSignalKey.keyId, keyIds)
      )
    );
}
