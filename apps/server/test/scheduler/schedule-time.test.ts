import { describe, expect, it } from "vitest";
import { initialNextRun, nextCronRun } from "../../src/scheduler/schedule-time";

describe("nextCronRun", () => {
  it("computes the next minute the cron matches after the reference time", () => {
    const after = new Date("2026-05-23T08:00:00Z");
    const next = nextCronRun("0 9 * * *", "UTC", after);
    expect(next?.toISOString()).toBe("2026-05-23T09:00:00.000Z");
  });

  it("evaluates the cron in the supplied timezone", () => {
    const after = new Date("2026-05-23T08:00:00Z");
    const next = nextCronRun("0 9 * * *", "America/New_York", after);
    // 09:00 ET in May is 13:00 UTC (EDT, -04:00).
    expect(next?.toISOString()).toBe("2026-05-23T13:00:00.000Z");
  });
});

describe("initialNextRun", () => {
  it("returns the runAt for a one-time schedule", () => {
    const runAt = new Date("2030-01-01T09:00:00Z");
    expect(initialNextRun({ scheduleKind: "once", runAt, cron: null, timezone: "UTC" })).toEqual(
      runAt
    );
  });

  it("returns null for a one-time schedule with no runAt", () => {
    expect(
      initialNextRun({ scheduleKind: "once", runAt: null, cron: null, timezone: "UTC" })
    ).toBeNull();
  });

  it("returns the next cron occurrence for a recurring schedule", () => {
    const result = initialNextRun({
      scheduleKind: "recurring",
      runAt: null,
      cron: "0 9 * * *",
      timezone: "UTC"
    });
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBeGreaterThan(Date.now());
  });

  it("returns null for a recurring schedule with no cron", () => {
    expect(
      initialNextRun({ scheduleKind: "recurring", runAt: null, cron: null, timezone: "UTC" })
    ).toBeNull();
  });
});
