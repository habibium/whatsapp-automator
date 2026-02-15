import { logger } from "@pkg/shared";
import cron, { type ScheduledTask } from "node-cron";
import { getAllEnabledScheduledMessages, getScheduledMessages } from "../db/queries.js";
import type { ScheduledMessageRow } from "../db/schema.js";
import { processTemplate } from "./template.js";
import { whatsappService } from "./whatsapp.js";

type ScheduledJob = {
  task: ScheduledTask;
  message: ScheduledMessageRow;
};

class SchedulerService {
  private jobs: Map<string, ScheduledJob> = new Map();

  async loadAllSchedules(): Promise<void> {
    const messages = await getAllEnabledScheduledMessages();
    logger.info({ count: messages.length }, "Loading scheduled messages");

    for (const message of messages) {
      this.scheduleMessage(message);
    }
  }

  async loadUserSchedules(userId: string): Promise<void> {
    const messages = await getScheduledMessages(userId);
    const enabledMessages = messages.filter((m) => m.enabled);

    // Remove existing jobs for this user
    for (const [id, job] of this.jobs) {
      if (job.message.userId === userId) {
        job.task.stop();
        this.jobs.delete(id);
      }
    }

    // Schedule new jobs
    for (const message of enabledMessages) {
      this.scheduleMessage(message);
    }

    logger.info({ userId, count: enabledMessages.length }, "Loaded user schedules");
  }

  scheduleMessage(message: ScheduledMessageRow): boolean {
    // Remove existing job if any
    this.removeSchedule(message.id);

    if (!message.enabled) {
      return false;
    }

    if (!cron.validate(message.cronExpression)) {
      logger.error(
        { messageId: message.id, cron: message.cronExpression },
        "Invalid cron expression"
      );
      return false;
    }

    const task = cron.schedule(
      message.cronExpression,
      async () => {
        logger.info(
          { messageId: message.id, target: message.target },
          "Triggering scheduled message"
        );

        const chatId = await whatsappService.findChat(
          message.userId,
          message.target,
          message.isGroup
        );

        if (chatId) {
          const processedMessage = await processTemplate(message.message, message.userId);
          logger.debug(
            { messageId: message.id, original: message.message, processed: processedMessage },
            "Processed template variables"
          );
          const sent = await whatsappService.sendMessage(message.userId, chatId, processedMessage);
          if (!sent) {
            logger.warn({ messageId: message.id }, "Failed to send scheduled message");
          }
        } else {
          logger.warn({ messageId: message.id, target: message.target }, "Chat not found");
        }
      },
      {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    );

    this.jobs.set(message.id, { task, message });
    logger.debug(
      { messageId: message.id, cron: message.cronExpression, target: message.target },
      "Scheduled message"
    );

    return true;
  }

  removeSchedule(messageId: string): void {
    const job = this.jobs.get(messageId);
    if (job) {
      job.task.stop();
      this.jobs.delete(messageId);
      logger.debug({ messageId }, "Removed schedule");
    }
  }

  updateSchedule(message: ScheduledMessageRow): void {
    if (message.enabled) {
      this.scheduleMessage(message);
    } else {
      this.removeSchedule(message.id);
    }
  }

  shutdown(): void {
    logger.info("Shutting down scheduler");
    for (const [id, job] of this.jobs) {
      job.task.stop();
      this.jobs.delete(id);
    }
  }
}

export const schedulerService = new SchedulerService();
