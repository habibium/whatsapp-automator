import { logger } from "../logger";
import { handleSendJobs, handleTickJobs } from "./dispatch";
import { boss, SEND_QUEUE, TICK_QUEUE } from "./queue";

export { enqueueSend } from "./dispatch";
export { initialNextRun, nextCronRun } from "./schedule-time";

/**
 * Boots the scheduler: starts pg-boss, registers workers, and installs the
 * per-minute tick that dispatches due scheduled messages.
 */
export async function startScheduler(): Promise<void> {
  await boss.start();
  boss.on("error", (err) => {
    logger.error({ err }, "pg-boss error");
  });

  await boss.createQueue(SEND_QUEUE, {
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 120
  });
  await boss.createQueue(TICK_QUEUE, { retryLimit: 0 });

  await boss.work(SEND_QUEUE, handleSendJobs);
  await boss.work(TICK_QUEUE, handleTickJobs);

  // Re-scheduling the same queue is idempotent across restarts.
  await boss.schedule(TICK_QUEUE, "* * * * *");

  logger.info("Scheduler started");
}

/** Gracefully drains and stops the scheduler. */
export async function stopScheduler(): Promise<void> {
  await boss.stop({ graceful: true });
  logger.info("Scheduler stopped");
}
