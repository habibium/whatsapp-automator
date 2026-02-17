import { eq } from "drizzle-orm";
import { db, schema } from "./index.js";

// User queries
export async function createUser(email: string, passwordHash: string) {
  const [user] = await db.insert(schema.users).values({ email, passwordHash }).returning();
  return user;
}

export async function getUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(schema.users.email, email)
  });
}

export async function getUserById(id: string) {
  return db.query.users.findFirst({
    where: eq(schema.users.id, id)
  });
}

// Session queries
export async function createSession(userId: string, expiresAt: Date) {
  const [session] = await db.insert(schema.sessions).values({ userId, expiresAt }).returning();
  return session;
}

export async function getSessionById(id: string) {
  return db.query.sessions.findFirst({
    where: eq(schema.sessions.id, id)
  });
}

export async function deleteSession(id: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
}

export async function deleteExpiredSessions() {
  await db.delete(schema.sessions).where(eq(schema.sessions.expiresAt, new Date()));
}

// WhatsApp connection queries
export async function getWhatsAppConnection(userId: string) {
  return db.query.whatsappConnections.findFirst({
    where: eq(schema.whatsappConnections.userId, userId)
  });
}

export async function upsertWhatsAppConnection(userId: string, authState: unknown, status: string) {
  const existing = await getWhatsAppConnection(userId);
  if (existing) {
    const [updated] = await db
      .update(schema.whatsappConnections)
      .set({ authState, status, updatedAt: new Date() })
      .where(eq(schema.whatsappConnections.userId, userId))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(schema.whatsappConnections)
    .values({ userId, authState, status })
    .returning();
  return created;
}

export async function updateWhatsAppStatus(userId: string, status: string) {
  await db
    .update(schema.whatsappConnections)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.whatsappConnections.userId, userId));
}

export async function clearWhatsAppAuthState(userId: string) {
  await db
    .update(schema.whatsappConnections)
    .set({ authState: null, status: "disconnected", updatedAt: new Date() })
    .where(eq(schema.whatsappConnections.userId, userId));
}

// Scheduled message queries
export async function getScheduledMessages(userId: string) {
  return db.query.scheduledMessages.findMany({
    where: eq(schema.scheduledMessages.userId, userId),
    orderBy: (messages, { desc }) => [desc(messages.createdAt)]
  });
}

export async function getAllEnabledScheduledMessages() {
  return db.query.scheduledMessages.findMany({
    where: eq(schema.scheduledMessages.enabled, true)
  });
}

export async function getScheduledMessageById(id: string, userId: string) {
  return db.query.scheduledMessages.findFirst({
    where: (messages, { and, eq: eqOp }) =>
      and(eqOp(messages.id, id), eqOp(messages.userId, userId))
  });
}

export async function createScheduledMessage(
  userId: string,
  data: {
    target: string;
    isGroup: boolean;
    message: string;
    cronExpression: string;
    enabled?: boolean;
  }
) {
  const [message] = await db
    .insert(schema.scheduledMessages)
    .values({ userId, ...data })
    .returning();
  return message;
}

export async function updateScheduledMessage(
  id: string,
  userId: string,
  data: Partial<{
    target: string;
    isGroup: boolean;
    message: string;
    cronExpression: string;
    enabled: boolean;
  }>
) {
  const existing = await getScheduledMessageById(id, userId);
  if (!existing) return undefined;

  const [updated] = await db
    .update(schema.scheduledMessages)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.scheduledMessages.id, id))
    .returning();
  return updated;
}

export async function deleteScheduledMessage(id: string, userId: string) {
  const message = await getScheduledMessageById(id, userId);
  if (!message) return false;
  await db.delete(schema.scheduledMessages).where(eq(schema.scheduledMessages.id, id));
  return true;
}
