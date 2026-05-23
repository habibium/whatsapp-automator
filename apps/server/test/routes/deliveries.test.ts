import { beforeEach, describe, expect, it, vi } from "vitest";

const { TEST_USER_ID } = vi.hoisted(() => ({
  TEST_USER_ID: "test-user-00000000-0000-0000-0000-000000000001"
}));

vi.mock("../../src/auth/middleware", async () => {
  const { createMiddleware } = await import("hono/factory");
  return {
    requireAuth: createMiddleware(async (c, next) => {
      const now = new Date();
      c.set("user", {
        id: TEST_USER_ID,
        email: "test@example.com",
        name: "Test",
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now
      });
      c.set("session", {
        id: "s",
        userId: TEST_USER_ID,
        token: "tok",
        expiresAt: new Date(Date.now() + 86_400_000),
        ipAddress: null,
        userAgent: null,
        createdAt: now,
        updatedAt: now
      });
      return next();
    })
  };
});

vi.mock("../../src/whatsapp/service", () => ({
  whatsappService: {
    sendMessage: vi.fn(),
    getStatus: vi.fn(),
    listGroups: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    logout: vi.fn()
  },
  resolveRecipientJid: vi.fn()
}));

vi.mock("../../src/scheduler/queue", () => ({
  SEND_QUEUE: "send-message",
  TICK_QUEUE: "scheduler-tick",
  boss: {
    send: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    createQueue: vi.fn(),
    work: vi.fn(),
    schedule: vi.fn(),
    on: vi.fn()
  }
}));

import { app } from "../../src/app";
import { createDelivery } from "../../src/db/repositories/deliveries";
import { resetDb, seedTestUser, TEST_USER } from "../helpers/db";

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDb();
  await seedTestUser();
});

describe("delivery routes", () => {
  it("returns an empty page when there's no history", async () => {
    const res = await app.request("/api/deliveries");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
  });

  it("paginates results, newest first", async () => {
    for (let i = 0; i < 3; i++) {
      await createDelivery({
        userId: TEST_USER.id,
        scheduledMessageId: null,
        recipientType: "contact",
        recipient: "+1",
        recipientName: null,
        body: `msg-${i}`
      });
    }
    const res = await app.request("/api/deliveries?limit=2&offset=0");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].body).toBe("msg-2");
  });

  it("rejects out-of-range pagination", async () => {
    const res = await app.request("/api/deliveries?limit=999");
    expect(res.status).toBe(400);
  });
});
