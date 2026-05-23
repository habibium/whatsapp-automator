import { describe, expect, it } from "vitest";
import {
  cronExpressionSchema,
  idParamSchema,
  listQuerySchema,
  MESSAGE_MAX_LENGTH,
  scheduledMessageInputSchema,
  sendNowSchema,
  templateInputSchema,
  toggleSchema
} from "./schemas";

describe("cronExpressionSchema", () => {
  it("accepts valid 5-field expressions", () => {
    for (const expr of ["0 9 * * *", "*/15 * * * *", "30 9 * * 1-5", "0 0 1 * *"]) {
      expect(cronExpressionSchema.safeParse(expr).success).toBe(true);
    }
  });

  it("rejects the wrong number of fields", () => {
    expect(cronExpressionSchema.safeParse("0 9 *").success).toBe(false);
    expect(cronExpressionSchema.safeParse("0 9 * * * *").success).toBe(false);
  });

  it("rejects unparseable cron strings", () => {
    expect(cronExpressionSchema.safeParse("never").success).toBe(false);
    expect(cronExpressionSchema.safeParse("99 99 * * *").success).toBe(false);
  });
});

describe("scheduledMessageInputSchema", () => {
  const baseOnce = {
    recipientType: "contact" as const,
    recipient: "+15555550100",
    body: "Hello",
    scheduleKind: "once" as const,
    runAt: new Date(Date.now() + 60_000).toISOString()
  };

  it("accepts a valid one-time schedule", () => {
    const result = scheduledMessageInputSchema.safeParse(baseOnce);
    expect(result.success).toBe(true);
  });

  it("applies defaults for timezone and enabled", () => {
    const parsed = scheduledMessageInputSchema.parse(baseOnce);
    expect(parsed.timezone).toBe("UTC");
    expect(parsed.enabled).toBe(true);
  });

  it("requires runAt for one-time schedules", () => {
    const { runAt, ...rest } = baseOnce;
    void runAt;
    const issues = scheduledMessageInputSchema.safeParse(rest).error?.issues ?? [];
    expect(issues.some((i) => i.path[0] === "runAt")).toBe(true);
  });

  it("rejects a past runAt", () => {
    const result = scheduledMessageInputSchema.safeParse({
      ...baseOnce,
      runAt: new Date(Date.now() - 1000).toISOString()
    });
    expect(result.success).toBe(false);
  });

  it("requires cron for recurring schedules", () => {
    const result = scheduledMessageInputSchema.safeParse({
      ...baseOnce,
      scheduleKind: "recurring",
      runAt: undefined
    });
    expect(result.success).toBe(false);
  });

  it("accepts a recurring schedule with a valid cron", () => {
    const result = scheduledMessageInputSchema.safeParse({
      ...baseOnce,
      scheduleKind: "recurring",
      runAt: undefined,
      cron: "0 9 * * *"
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty body", () => {
    expect(scheduledMessageInputSchema.safeParse({ ...baseOnce, body: "" }).success).toBe(false);
  });

  it("rejects a body over the limit", () => {
    expect(
      scheduledMessageInputSchema.safeParse({
        ...baseOnce,
        body: "x".repeat(MESSAGE_MAX_LENGTH + 1)
      }).success
    ).toBe(false);
  });
});

describe("templateInputSchema", () => {
  it("requires a non-empty name and body", () => {
    expect(templateInputSchema.safeParse({ name: "", body: "" }).success).toBe(false);
    expect(templateInputSchema.safeParse({ name: "Greeting", body: "Hi" }).success).toBe(true);
  });
});

describe("sendNowSchema", () => {
  it("requires recipient and body", () => {
    expect(
      sendNowSchema.safeParse({ recipientType: "contact", recipient: "+1", body: "" }).success
    ).toBe(false);
    expect(
      sendNowSchema.safeParse({ recipientType: "contact", recipient: "", body: "hi" }).success
    ).toBe(false);
    expect(
      sendNowSchema.safeParse({ recipientType: "contact", recipient: "+1", body: "hi" }).success
    ).toBe(true);
  });
});

describe("toggleSchema", () => {
  it("requires a boolean", () => {
    expect(toggleSchema.safeParse({ enabled: true }).success).toBe(true);
    expect(toggleSchema.safeParse({ enabled: "yes" }).success).toBe(false);
  });
});

describe("idParamSchema", () => {
  it("requires a UUID string", () => {
    expect(idParamSchema.safeParse({ id: "550e8400-e29b-41d4-a716-446655440000" }).success).toBe(
      true
    );
    expect(idParamSchema.safeParse({ id: "abc" }).success).toBe(false);
  });
});

describe("listQuerySchema", () => {
  it("coerces numeric strings and applies defaults", () => {
    expect(listQuerySchema.parse({})).toEqual({ limit: 50, offset: 0 });
    expect(listQuerySchema.parse({ limit: "20", offset: "10" })).toEqual({ limit: 20, offset: 10 });
  });

  it("rejects out-of-range values", () => {
    expect(listQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
    expect(listQuerySchema.safeParse({ limit: "200" }).success).toBe(false);
  });
});
