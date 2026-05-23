import { and, asc, eq } from "drizzle-orm";
import { db } from "../client";
import { type MessageTemplate, messageTemplate } from "../schema";

export type TemplateFields = { name: string; body: string };

/** All of a user's message templates, alphabetically. */
export function listTemplates(userId: string): Promise<MessageTemplate[]> {
  return db
    .select()
    .from(messageTemplate)
    .where(eq(messageTemplate.userId, userId))
    .orderBy(asc(messageTemplate.name));
}

export async function findTemplate(
  id: string,
  userId: string
): Promise<MessageTemplate | undefined> {
  const [row] = await db
    .select()
    .from(messageTemplate)
    .where(and(eq(messageTemplate.id, id), eq(messageTemplate.userId, userId)));
  return row;
}

export async function createTemplate(
  userId: string,
  fields: TemplateFields
): Promise<MessageTemplate> {
  const [row] = await db
    .insert(messageTemplate)
    .values({ userId, ...fields })
    .returning();
  return row!;
}

export async function updateTemplate(
  id: string,
  userId: string,
  fields: TemplateFields
): Promise<MessageTemplate | undefined> {
  const [row] = await db
    .update(messageTemplate)
    .set(fields)
    .where(and(eq(messageTemplate.id, id), eq(messageTemplate.userId, userId)))
    .returning();
  return row;
}

export async function deleteTemplate(id: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(messageTemplate)
    .where(and(eq(messageTemplate.id, id), eq(messageTemplate.userId, userId)))
    .returning({ id: messageTemplate.id });
  return rows.length > 0;
}
