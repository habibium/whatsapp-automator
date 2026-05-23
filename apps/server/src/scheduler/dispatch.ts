import type { RecipientType } from "@pkg/shared";
import type { Job } from "pg-boss";
import {
  createDelivery,
  markDeliveryFailed,
  markDeliverySent
} from "../db/repositories/deliveries";
import {
  advanceScheduledMessage,
  findDueScheduledMessages
} from "../db/repositories/scheduled-messages";
import { logger } from "../logger";
import { resolveRecipientJid, whatsappService } from "../whatsapp/service";
import { boss, SEND_QUEUE } from "./queue";
import { nextCronRun } from "./schedule-time";

/** Payload of a `send-message` job. */
export type SendJobData = {
  deliveryId: string;
  userId: string;
  recipientType: RecipientType;
  recipient: string;
  body: string;
};

export type EnqueueSendParams = {
  userId: string;
  scheduledMessageId: string | null;
  recipientType: RecipientType;
  recipient: string;
  recipientName: string | null;
  body: string;
};

/**
 * Records a pending delivery and enqueues a job to send it.
 * Used both by the scheduler tick and the ad-hoc "send now" endpoint.
 */
export async function enqueueSend(params: EnqueueSendParams): Promise<string> {
  const delivery = await createDelivery({
    userId: params.userId,
    scheduledMessageId: params.scheduledMessageId,
    recipientType: params.recipientType,
    recipient: params.recipient,
    recipientName: params.recipientName,
    body: params.body
  });

  const data: SendJobData = {
    deliveryId: delivery.id,
    userId: params.userId,
    recipientType: params.recipientType,
    recipient: params.recipient,
    body: params.body
  };
  await boss.send(SEND_QUEUE, data);
  return delivery.id;
}

/** Worker: delivers one message via WhatsApp and records the outcome. */
export async function handleSendJobs(jobs: Job<SendJobData>[]): Promise<void> {
  for (const job of jobs) {
    const { deliveryId, userId, recipientType, recipient, body } = job.data;
    try {
      const jid = resolveRecipientJid(recipientType, recipient);
      await whatsappService.sendMessage(userId, jid, body);
      await markDeliverySent(deliveryId);
      logger.info({ deliveryId, userId }, "Message delivered");
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown error";
      await markDeliveryFailed(deliveryId, reason);
      logger.warn({ deliveryId, userId, err }, "Message delivery failed");
      throw err; // surface to pg-boss so the job is retried
    }
  }
}

/** Worker: enqueues sends for every scheduled message that is now due. */
export async function handleTickJobs(_jobs: Job[]): Promise<void> {
  const now = new Date();
  const due = await findDueScheduledMessages(now);
  if (due.length === 0) return;

  logger.info({ count: due.length }, "Scheduler tick dispatching due messages");
  for (const message of due) {
    try {
      await enqueueSend({
        userId: message.userId,
        scheduledMessageId: message.id,
        recipientType: message.recipientType,
        recipient: message.recipient,
        recipientName: message.recipientName,
        body: message.body
      });

      const nextRunAt =
        message.scheduleKind === "recurring" && message.cron
          ? nextCronRun(message.cron, message.timezone, now)
          : null;
      await advanceScheduledMessage(message.id, {
        nextRunAt,
        lastRunAt: now,
        ...(nextRunAt ? {} : { enabled: false })
      });
    } catch (err) {
      logger.error({ messageId: message.id, err }, "Failed to dispatch scheduled message");
    }
  }
}
