/**
 * Shared literal enums used across the server and web client.
 * Each is exported as a readonly tuple (for runtime use, e.g. Zod / iteration)
 * and a derived union type (for compile-time use).
 */

/** How a scheduled message addresses its recipient. */
export const RECIPIENT_TYPES = ["contact", "group"] as const;
export type RecipientType = (typeof RECIPIENT_TYPES)[number];

/** Whether a schedule fires a single time or repeats on a cron. */
export const SCHEDULE_KINDS = ["once", "recurring"] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

/** Lifecycle state of a user's WhatsApp connection. */
export const CONNECTION_STATUSES = ["disconnected", "connecting", "qr", "connected"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Outcome of an individual message delivery attempt. */
export const DELIVERY_STATUSES = ["pending", "sent", "failed"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
