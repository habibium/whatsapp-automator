import type { Delivery, MessageTemplate, ScheduledMessage } from "../db/schema";

/**
 * Row → API DTO mappers. Date columns become ISO-8601 strings so the Hono RPC
 * client infers accurate (string, not Date) response types.
 */

export function serializeScheduledMessage(row: ScheduledMessage) {
  return {
    id: row.id,
    userId: row.userId,
    recipientType: row.recipientType,
    recipient: row.recipient,
    recipientName: row.recipientName,
    body: row.body,
    scheduleKind: row.scheduleKind,
    runAt: row.runAt?.toISOString() ?? null,
    cron: row.cron,
    timezone: row.timezone,
    templateId: row.templateId,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function serializeTemplate(row: MessageTemplate) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export function serializeDelivery(row: Delivery) {
  return {
    id: row.id,
    userId: row.userId,
    scheduledMessageId: row.scheduledMessageId,
    recipientType: row.recipientType,
    recipient: row.recipient,
    recipientName: row.recipientName,
    body: row.body,
    status: row.status,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null
  };
}

export type ScheduledMessageDTO = ReturnType<typeof serializeScheduledMessage>;
export type TemplateDTO = ReturnType<typeof serializeTemplate>;
export type DeliveryDTO = ReturnType<typeof serializeDelivery>;
