import { beforeEach, describe, expect, it } from "vitest";
import {
  createDelivery,
  listDeliveries,
  markDeliveryFailed,
  markDeliverySent
} from "../../../src/db/repositories/deliveries";
import { resetDb, seedTestUser, TEST_USER } from "../../helpers/db";

function deliveryDraft(overrides: Partial<{ body: string }> = {}) {
  return {
    userId: TEST_USER.id,
    scheduledMessageId: null,
    recipientType: "contact" as const,
    recipient: "+15555550100",
    recipientName: "Alice",
    body: "hello",
    ...overrides
  };
}

beforeEach(async () => {
  await resetDb();
  await seedTestUser();
});

describe("delivery repository", () => {
  it("creates a delivery in pending status", async () => {
    const row = await createDelivery(deliveryDraft());
    expect(row.status).toBe("pending");
    expect(row.error).toBeNull();
    expect(row.sentAt).toBeNull();
  });

  it("marks a delivery as sent", async () => {
    const row = await createDelivery(deliveryDraft());
    await markDeliverySent(row.id);
    const { items } = await listDeliveries(TEST_USER.id, { limit: 10, offset: 0 });
    const updated = items.find((d) => d.id === row.id);
    expect(updated?.status).toBe("sent");
    expect(updated?.sentAt).toBeInstanceOf(Date);
    expect(updated?.error).toBeNull();
  });

  it("marks a delivery as failed and records the error", async () => {
    const row = await createDelivery(deliveryDraft());
    await markDeliveryFailed(row.id, "WhatsApp not connected");
    const { items } = await listDeliveries(TEST_USER.id, { limit: 10, offset: 0 });
    const updated = items.find((d) => d.id === row.id);
    expect(updated?.status).toBe("failed");
    expect(updated?.error).toBe("WhatsApp not connected");
  });

  it("paginates and returns a total count", async () => {
    for (let i = 0; i < 5; i++) {
      await createDelivery(deliveryDraft({ body: `msg-${i}` }));
    }
    const page1 = await listDeliveries(TEST_USER.id, { limit: 2, offset: 0 });
    const page2 = await listDeliveries(TEST_USER.id, { limit: 2, offset: 2 });
    expect(page1.total).toBe(5);
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    // newest first
    expect(page1.items[0]!.body).toBe("msg-4");
  });
});
