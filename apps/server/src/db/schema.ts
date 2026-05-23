import type { ConnectionStatus, DeliveryStatus, RecipientType, ScheduleKind } from "@pkg/shared";
import {
  boolean,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

// ── Better Auth tables ───────────────────────────────────────────────
// Shape mandated by Better Auth's Drizzle adapter (user/session/account/verification).

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (t) => [index("session_user_id_idx").on(t.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (t) => [index("account_user_id_idx").on(t.userId)]
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

// ── WhatsApp connection ──────────────────────────────────────────────

/** One row per user — the Baileys credential blob, encrypted at rest. */
export const whatsappSession = pgTable("whatsapp_session", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Encrypted Baileys `AuthenticationCreds` JSON. */
  creds: text("creds"),
  /** Connected phone number, once paired. */
  phoneNumber: varchar("phone_number", { length: 32 }),
  status: varchar("status", { length: 16 })
    .notNull()
    .default("disconnected")
    .$type<ConnectionStatus>(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
});

/** Baileys Signal protocol keys — one row per key, encrypted at rest. */
export const whatsappSignalKey = pgTable(
  "whatsapp_signal_key",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 64 }).notNull(),
    keyId: varchar("key_id", { length: 255 }).notNull(),
    /** Encrypted JSON value. */
    data: text("data").notNull()
  },
  (t) => [primaryKey({ columns: [t.userId, t.category, t.keyId] })]
);

// ── Message templates ────────────────────────────────────────────────

export const messageTemplate = pgTable(
  "message_template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (t) => [index("message_template_user_id_idx").on(t.userId)]
);

// ── Scheduled messages ───────────────────────────────────────────────

export const scheduledMessage = pgTable(
  "scheduled_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recipientType: varchar("recipient_type", { length: 16 }).notNull().$type<RecipientType>(),
    recipient: varchar("recipient", { length: 255 }).notNull(),
    recipientName: varchar("recipient_name", { length: 255 }),
    body: text("body").notNull(),
    scheduleKind: varchar("schedule_kind", { length: 16 }).notNull().$type<ScheduleKind>(),
    /** Set for one-time schedules. */
    runAt: timestamp("run_at", { withTimezone: true }),
    /** Set for recurring schedules. */
    cron: varchar("cron", { length: 100 }),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    templateId: uuid("template_id").references(() => messageTemplate.id, {
      onDelete: "set null"
    }),
    enabled: boolean("enabled").notNull().default(true),
    /** When the scheduler should next fire this message. NULL once exhausted. */
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (t) => [
    index("scheduled_message_user_id_idx").on(t.userId),
    // Serves the scheduler tick's "due messages" query.
    index("scheduled_message_due_idx").on(t.enabled, t.nextRunAt)
  ]
);

// ── Deliveries ───────────────────────────────────────────────────────

/** A record of every send attempt — scheduled or ad-hoc. */
export const delivery = pgTable(
  "delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** NULL for ad-hoc sends, or if the source schedule was later deleted. */
    scheduledMessageId: uuid("scheduled_message_id").references(() => scheduledMessage.id, {
      onDelete: "set null"
    }),
    recipientType: varchar("recipient_type", { length: 16 }).notNull().$type<RecipientType>(),
    recipient: varchar("recipient", { length: 255 }).notNull(),
    recipientName: varchar("recipient_name", { length: 255 }),
    body: text("body").notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending").$type<DeliveryStatus>(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true })
  },
  (t) => [
    index("delivery_user_created_idx").on(t.userId, t.createdAt),
    index("delivery_scheduled_message_idx").on(t.scheduledMessageId)
  ]
);

// ── Inferred row types ───────────────────────────────────────────────

export type User = typeof user.$inferSelect;
export type WhatsappSession = typeof whatsappSession.$inferSelect;
export type WhatsappSignalKey = typeof whatsappSignalKey.$inferSelect;
export type MessageTemplate = typeof messageTemplate.$inferSelect;
export type NewMessageTemplate = typeof messageTemplate.$inferInsert;
export type ScheduledMessage = typeof scheduledMessage.$inferSelect;
export type NewScheduledMessage = typeof scheduledMessage.$inferInsert;
export type Delivery = typeof delivery.$inferSelect;
export type NewDelivery = typeof delivery.$inferInsert;
