import { Cron } from "croner";
import { z } from "zod";
import { RECIPIENT_TYPES, SCHEDULE_KINDS } from "./enums";

/** WhatsApp's text limit is ~65k; we cap lower to keep payloads sane. */
export const MESSAGE_MAX_LENGTH = 4096;

/**
 * A standard 5-field cron expression (minute granularity).
 * Sub-minute scheduling is intentionally unsupported — it risks WhatsApp bans.
 */
export const cronExpressionSchema = z
  .string()
  .trim()
  .refine((value) => value.split(/\s+/).filter(Boolean).length === 5, {
    message: "Cron must have exactly 5 fields: minute hour day month weekday"
  })
  .refine(
    (value) => {
      try {
        // croner throws on invalid patterns.
        void new Cron(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Invalid cron expression" }
  );

// ── Reusable field schemas ───────────────────────────────────────────

const recipientType = z.enum(RECIPIENT_TYPES);

const recipient = z.string().trim().min(1, "Recipient is required").max(255);

const recipientName = z.string().trim().max(255).optional();

const messageBody = z
  .string()
  .trim()
  .min(1, "Message cannot be empty")
  .max(MESSAGE_MAX_LENGTH, `Message cannot exceed ${MESSAGE_MAX_LENGTH} characters`);

// ── Scheduled messages ───────────────────────────────────────────────

const scheduledMessageBase = z.object({
  recipientType,
  recipient,
  recipientName,
  body: messageBody,
  scheduleKind: z.enum(SCHEDULE_KINDS),
  /** Required when scheduleKind is "once" — an ISO-8601 timestamp. */
  runAt: z.iso.datetime({ offset: true }).optional(),
  /** Required when scheduleKind is "recurring". */
  cron: cronExpressionSchema.optional(),
  /** IANA timezone the cron expression is evaluated in. */
  timezone: z.string().trim().min(1).max(64).default("UTC"),
  /** Optional template this message was created from. */
  templateId: z.uuid().nullish(),
  enabled: z.boolean().default(true)
});

/** Create or fully replace a scheduled message. */
export const scheduledMessageInputSchema = scheduledMessageBase
  .refine((data) => data.scheduleKind !== "once" || Boolean(data.runAt), {
    path: ["runAt"],
    message: "A send time is required for one-time schedules"
  })
  .refine(
    (data) =>
      data.scheduleKind !== "once" || !data.runAt || new Date(data.runAt).getTime() > Date.now(),
    { path: ["runAt"], message: "Send time must be in the future" }
  )
  .refine((data) => data.scheduleKind !== "recurring" || Boolean(data.cron), {
    path: ["cron"],
    message: "A cron schedule is required for recurring schedules"
  });

export type ScheduledMessageInput = z.infer<typeof scheduledMessageInputSchema>;

/** Toggle a schedule on or off without editing it. */
export const toggleSchema = z.object({ enabled: z.boolean() });
export type ToggleInput = z.infer<typeof toggleSchema>;

// ── Message templates ────────────────────────────────────────────────

export const templateInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  body: messageBody
});
export type TemplateInput = z.infer<typeof templateInputSchema>;

// ── Ad-hoc send ──────────────────────────────────────────────────────

/** Send a message immediately, bypassing the scheduler. */
export const sendNowSchema = z.object({
  recipientType,
  recipient,
  recipientName,
  body: messageBody
});
export type SendNowInput = z.infer<typeof sendNowSchema>;

// ── Pagination ───────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/** Path-parameter schema for routes addressed by a UUID. */
export const idParamSchema = z.object({ id: z.uuid() });
export type IdParam = z.infer<typeof idParamSchema>;
