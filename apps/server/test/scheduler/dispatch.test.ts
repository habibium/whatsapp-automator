import type { Job } from "pg-boss";
import { beforeEach, describe, expect, it, vi } from "vitest";

// pg-boss and the WhatsApp service must be mocked before dispatch is imported.
vi.mock("../../src/scheduler/queue", () => ({
  SEND_QUEUE: "send-message",
  TICK_QUEUE: "scheduler-tick",
  boss: { send: vi.fn() }
}));

vi.mock("../../src/whatsapp/service", () => ({
  whatsappService: { sendMessage: vi.fn() },
  resolveRecipientJid: (type: string, recipient: string) =>
    type === "group" ? recipient : `${recipient}@s.whatsapp.net`
}));

import { listDeliveries } from "../../src/db/repositories/deliveries";
import {
  createScheduledMessage,
  findScheduledMessage
} from "../../src/db/repositories/scheduled-messages";
import {
  enqueueSend,
  handleSendJobs,
  handleTickJobs,
  type SendJobData
} from "../../src/scheduler/dispatch";
import { boss } from "../../src/scheduler/queue";
import { whatsappService } from "../../src/whatsapp/service";
import { resetDb, seedTestUser, TEST_USER } from "../helpers/db";

function makeJob<T>(data: T): Job<T> {
  return {
    id: "job-1",
    name: "send-message",
    data,
    expireInSeconds: 60,
    heartbeatSeconds: null,
    signal: new AbortController().signal
  };
}

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDb();
  await seedTestUser();
});

describe("enqueueSend", () => {
  it("records a pending delivery and enqueues a send job", async () => {
    const deliveryId = await enqueueSend({
      userId: TEST_USER.id,
      scheduledMessageId: null,
      recipientType: "contact",
      recipient: "+15555550100",
      recipientName: "Alice",
      body: "hi"
    });

    expect(boss.send).toHaveBeenCalledWith(
      "send-message",
      expect.objectContaining({ deliveryId, body: "hi" })
    );
    const { items } = await listDeliveries(TEST_USER.id, { limit: 10, offset: 0 });
    expect(items[0]?.status).toBe("pending");
  });
});

describe("handleSendJobs", () => {
  it("marks the delivery sent on success", async () => {
    const deliveryId = await enqueueSend({
      userId: TEST_USER.id,
      scheduledMessageId: null,
      recipientType: "contact",
      recipient: "+15555550100",
      recipientName: null,
      body: "hi"
    });
    vi.mocked(whatsappService.sendMessage).mockResolvedValueOnce(undefined);

    await handleSendJobs([
      makeJob<SendJobData>({
        deliveryId,
        userId: TEST_USER.id,
        recipientType: "contact",
        recipient: "+15555550100",
        body: "hi"
      })
    ]);

    expect(whatsappService.sendMessage).toHaveBeenCalledWith(
      TEST_USER.id,
      "+15555550100@s.whatsapp.net",
      "hi"
    );
    const { items } = await listDeliveries(TEST_USER.id, { limit: 10, offset: 0 });
    expect(items[0]?.status).toBe("sent");
  });

  it("marks failed and rethrows when WhatsApp send throws", async () => {
    const deliveryId = await enqueueSend({
      userId: TEST_USER.id,
      scheduledMessageId: null,
      recipientType: "contact",
      recipient: "+15555550100",
      recipientName: null,
      body: "hi"
    });
    vi.mocked(whatsappService.sendMessage).mockRejectedValueOnce(new Error("not connected"));

    await expect(
      handleSendJobs([
        makeJob<SendJobData>({
          deliveryId,
          userId: TEST_USER.id,
          recipientType: "contact",
          recipient: "+15555550100",
          body: "hi"
        })
      ])
    ).rejects.toThrow("not connected");

    const { items } = await listDeliveries(TEST_USER.id, { limit: 10, offset: 0 });
    expect(items[0]?.status).toBe("failed");
    expect(items[0]?.error).toBe("not connected");
  });
});

describe("handleTickJobs", () => {
  it("dispatches due messages and advances them", async () => {
    const past = new Date(Date.now() - 60_000);
    const onceMessage = await createScheduledMessage({
      userId: TEST_USER.id,
      recipientType: "contact",
      recipient: "+15555550111",
      recipientName: null,
      body: "once",
      scheduleKind: "once",
      runAt: past,
      cron: null,
      timezone: "UTC",
      templateId: null,
      enabled: true,
      nextRunAt: past
    });
    const recurringMessage = await createScheduledMessage({
      userId: TEST_USER.id,
      recipientType: "contact",
      recipient: "+15555550112",
      recipientName: null,
      body: "recurring",
      scheduleKind: "recurring",
      runAt: null,
      cron: "0 9 * * *",
      timezone: "UTC",
      templateId: null,
      enabled: true,
      nextRunAt: past
    });
    const futureMessage = await createScheduledMessage({
      userId: TEST_USER.id,
      recipientType: "contact",
      recipient: "+15555550113",
      recipientName: null,
      body: "future",
      scheduleKind: "once",
      runAt: new Date(Date.now() + 60_000),
      cron: null,
      timezone: "UTC",
      templateId: null,
      enabled: true,
      nextRunAt: new Date(Date.now() + 60_000)
    });

    await handleTickJobs([]);

    expect(boss.send).toHaveBeenCalledTimes(2);

    const onceAfter = await findScheduledMessage(onceMessage.id, TEST_USER.id);
    expect(onceAfter?.enabled).toBe(false);
    expect(onceAfter?.nextRunAt).toBeNull();

    const recurringAfter = await findScheduledMessage(recurringMessage.id, TEST_USER.id);
    expect(recurringAfter?.enabled).toBe(true);
    expect(recurringAfter?.nextRunAt?.getTime()).toBeGreaterThan(Date.now());

    const futureAfter = await findScheduledMessage(futureMessage.id, TEST_USER.id);
    expect(futureAfter?.nextRunAt?.toISOString()).toBe(futureMessage.nextRunAt?.toISOString());
  });
});
