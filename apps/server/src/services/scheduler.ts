import { logger } from "@pkg/shared";
import cron, { type ScheduledTask } from "node-cron";
import {
  getAllEnabledScheduledMessages,
  getScheduledMessages,
  updateScheduledMessage
} from "../db/queries.js";
import type { ScheduledMessageRow } from "../db/schema.js";
import { processTemplate } from "./template.js";
import { whatsappService } from "./whatsapp.js";

type ScheduledJob =
  | {
      task: ScheduledTask;
      message: ScheduledMessageRow;
    }
  | {
      timer: ReturnType<typeof setTimeout>;
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
        this.stopJob(job);
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

    if (message.scheduleType === "once") {
      return this.scheduleOnce(message);
    }

    return this.scheduleRecurring(message);
  }

  private scheduleOnce(message: ScheduledMessageRow): boolean {
    if (!message.scheduledAt) {
      logger.error({ messageId: message.id }, "One-time schedule missing scheduledAt timestamp");
      return false;
    }

    const now = Date.now();
    const targetTime = new Date(message.scheduledAt).getTime();
    const delay = targetTime - now;

    if (delay <= 0) {
      logger.warn(
        { messageId: message.id, scheduledAt: message.scheduledAt },
        "One-time schedule is in the past, auto-disabling"
      );
      // Auto-disable past one-time schedules
      updateScheduledMessage(message.id, message.userId, { enabled: false }).catch((err) => {
        logger.error(
          { messageId: message.id, err },
          "Failed to auto-disable past one-time schedule"
        );
      });
      return false;
    }

    const timer = setTimeout(async () => {
      logger.info(
        { messageId: message.id, target: message.target },
        "Triggering one-time scheduled message"
      );

      await this.sendMessage(message);

      // Auto-disable after firing
      try {
        await updateScheduledMessage(message.id, message.userId, { enabled: false });
        logger.info({ messageId: message.id }, "One-time schedule auto-disabled after firing");
      } catch (err) {
        logger.error({ messageId: message.id, err }, "Failed to auto-disable one-time schedule");
      }

      this.jobs.delete(message.id);
    }, delay);

    this.jobs.set(message.id, { timer, message });
    logger.debug(
      {
        messageId: message.id,
        scheduledAt: message.scheduledAt,
        delayMs: delay,
        target: message.target
      },
      "Scheduled one-time message"
    );

    return true;
  }

  private scheduleRecurring(message: ScheduledMessageRow): boolean {
    if (!message.cronExpression) {
      logger.error({ messageId: message.id }, "Recurring schedule missing cron expression");
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
        await this.sendMessage(message);
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

  private async sendMessage(message: ScheduledMessageRow): Promise<void> {
    const chatId = await whatsappService.findChat(message.userId, message.target, message.isGroup);

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
  }

  removeSchedule(messageId: string): void {
    const job = this.jobs.get(messageId);
    if (job) {
      this.stopJob(job);
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
      this.stopJob(job);
      this.jobs.delete(id);
    }
  }

  private stopJob(job: ScheduledJob): void {
    if ("task" in job) {
      job.task.stop();
    } else {
      clearTimeout(job.timer);
    }
  }
}

export const schedulerService = new SchedulerService();
