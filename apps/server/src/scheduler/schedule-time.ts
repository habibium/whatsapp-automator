import type { ScheduleKind } from "@pkg/shared";
import { Cron } from "croner";

/** The next time a cron expression fires strictly after `after` (default: now). */
export function nextCronRun(cron: string, timezone: string, after: Date = new Date()): Date | null {
  return new Cron(cron, { timezone }).nextRun(after);
}

export type ScheduleTiming = {
  scheduleKind: ScheduleKind;
  runAt: Date | null;
  cron: string | null;
  timezone: string;
};

/**
 * The `nextRunAt` value to persist when a schedule is created or edited.
 * One-time schedules fire at `runAt`; recurring schedules at the next cron hit.
 */
export function initialNextRun(timing: ScheduleTiming): Date | null {
  if (timing.scheduleKind === "once") return timing.runAt;
  if (!timing.cron) return null;
  return nextCronRun(timing.cron, timing.timezone);
}
