import { describe, expect, it } from "vitest";
import type { Delivery, MessageTemplate, ScheduledMessage } from "../../src/db/schema";
import {
  serializeDelivery,
  serializeScheduledMessage,
  serializeTemplate
} from "../../src/lib/serializers";

const now = new Date("2026-05-23T12:00:00.000Z");

describe("serializers", () => {
  it("converts scheduled-message date columns to ISO strings", () => {
    const row: ScheduledMessage = {
      id: "id",
      userId: "u",
      recipientType: "contact",
      recipient: "+1",
      recipientName: null,
      body: "b",
      scheduleKind: "once",
      runAt: now,
      cron: null,
      timezone: "UTC",
      templateId: null,
      enabled: true,
      nextRunAt: now,
      lastRunAt: null,
      createdAt: now,
      updatedAt: now
    };
    const dto = serializeScheduledMessage(row);
    expect(dto.runAt).toBe(now.toISOString());
    expect(dto.nextRunAt).toBe(now.toISOString());
    expect(dto.lastRunAt).toBeNull();
    expect(dto.createdAt).toBe(now.toISOString());
    expect(dto.updatedAt).toBe(now.toISOString());
  });

  it("serializes templates", () => {
    const row: MessageTemplate = {
      id: "id",
      userId: "u",
      name: "n",
      body: "b",
      createdAt: now,
      updatedAt: now
    };
    expect(serializeTemplate(row).createdAt).toBe(now.toISOString());
  });

  it("serializes deliveries with nullable sentAt", () => {
    const base: Delivery = {
      id: "id",
      userId: "u",
      scheduledMessageId: null,
      recipientType: "contact",
      recipient: "+1",
      recipientName: null,
      body: "b",
      status: "pending",
      error: null,
      createdAt: now,
      sentAt: null
    };
    expect(serializeDelivery(base).sentAt).toBeNull();
    expect(serializeDelivery({ ...base, sentAt: now, status: "sent" }).sentAt).toBe(
      now.toISOString()
    );
  });
});
