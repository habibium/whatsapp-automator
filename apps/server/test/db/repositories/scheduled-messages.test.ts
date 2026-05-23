import { beforeEach, describe, expect, it } from "vitest";
import {
  advanceScheduledMessage,
  createScheduledMessage,
  deleteScheduledMessage,
  findDueScheduledMessages,
  findScheduledMessage,
  listScheduledMessages,
  type ScheduledMessageInsert,
  updateScheduledMessage
} from "../../../src/db/repositories/scheduled-messages";
import { resetDb, seedTestUser, TEST_USER } from "../../helpers/db";

function draft(overrides: Partial<ScheduledMessageInsert> = {}): ScheduledMessageInsert {
  const runAt = new Date(Date.now() + 60_000);
  return {
    userId: TEST_USER.id,
    recipientType: "contact",
    recipient: "+15555550100",
    recipientName: "Alice",
    body: "hello",
    scheduleKind: "once",
    runAt,
    cron: null,
    timezone: "UTC",
    templateId: null,
    enabled: true,
    nextRunAt: runAt,
    ...overrides
  };
}

beforeEach(async () => {
  await resetDb();
  await seedTestUser();
});

describe("scheduled message repository", () => {
  it("creates, finds, updates and deletes a message", async () => {
    const created = await createScheduledMessage(draft());
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);

    const found = await findScheduledMessage(created.id, TEST_USER.id);
    expect(found?.body).toBe("hello");

    const updated = await updateScheduledMessage(created.id, TEST_USER.id, { body: "world" });
    expect(updated?.body).toBe("world");

    expect(await deleteScheduledMessage(created.id, TEST_USER.id)).toBe(true);
    expect(await findScheduledMessage(created.id, TEST_USER.id)).toBeUndefined();
  });

  it("scopes reads and writes by user", async () => {
    const created = await createScheduledMessage(draft());
    expect(await findScheduledMessage(created.id, "other-user")).toBeUndefined();
    expect(await deleteScheduledMessage(created.id, "other-user")).toBe(false);
  });

  it("lists every message belonging to a user", async () => {
    await createScheduledMessage(draft({ body: "one" }));
    await createScheduledMessage(draft({ body: "two" }));
    const all = await listScheduledMessages(TEST_USER.id);
    expect(all.map((m) => m.body).sort()).toEqual(["one", "two"]);
  });

  it("returns only due, enabled messages", async () => {
    await createScheduledMessage(draft({ nextRunAt: new Date(Date.now() - 1000), body: "due" }));
    await createScheduledMessage(
      draft({ nextRunAt: new Date(Date.now() + 60_000), body: "later" })
    );
    await createScheduledMessage(
      draft({ nextRunAt: new Date(Date.now() - 1000), enabled: false, body: "off" })
    );

    const due = await findDueScheduledMessages(new Date());
    expect(due).toHaveLength(1);
    expect(due[0]?.body).toBe("due");
  });

  it("advances the next-run timestamp", async () => {
    const created = await createScheduledMessage(draft());
    const future = new Date(Date.now() + 3_600_000);
    const lastRun = new Date();

    await advanceScheduledMessage(created.id, { nextRunAt: future, lastRunAt: lastRun });

    const after = await findScheduledMessage(created.id, TEST_USER.id);
    expect(after?.nextRunAt?.toISOString()).toBe(future.toISOString());
    expect(after?.lastRunAt?.toISOString()).toBe(lastRun.toISOString());
  });

  it("can disable a one-time message after firing", async () => {
    const created = await createScheduledMessage(draft());
    await advanceScheduledMessage(created.id, {
      nextRunAt: null,
      lastRunAt: new Date(),
      enabled: false
    });
    const after = await findScheduledMessage(created.id, TEST_USER.id);
    expect(after?.enabled).toBe(false);
    expect(after?.nextRunAt).toBeNull();
  });
});
