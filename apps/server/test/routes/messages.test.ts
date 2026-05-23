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
        name: "Test User",
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now
      });
      c.set("session", {
        id: "test-session",
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
    getStatus: vi.fn().mockReturnValue({ status: "disconnected", qr: null, phoneNumber: null }),
    listGroups: vi.fn().mockResolvedValue([]),
    connect: vi.fn(),
    disconnect: vi.fn(),
    logout: vi.fn()
  },
  resolveRecipientJid: (type: string, recipient: string) =>
    type === "group" ? recipient : `${recipient}@s.whatsapp.net`
}));

vi.mock("../../src/scheduler/queue", () => ({
  SEND_QUEUE: "send-message",
  TICK_QUEUE: "scheduler-tick",
  boss: {
    send: vi.fn().mockResolvedValue("job-id"),
    start: vi.fn(),
    stop: vi.fn(),
    createQueue: vi.fn(),
    work: vi.fn(),
    schedule: vi.fn(),
    on: vi.fn()
  }
}));

import { app } from "../../src/app";
import { boss } from "../../src/scheduler/queue";
import { resetDb, seedTestUser } from "../helpers/db";
import { jsonRequest } from "../helpers/http";

const validOnce = () => ({
  recipientType: "contact",
  recipient: "+15555550100",
  body: "hello",
  scheduleKind: "once",
  runAt: new Date(Date.now() + 60_000).toISOString()
});

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDb();
  await seedTestUser();
});

describe("messages routes", () => {
  it("lists nothing for a fresh account", async () => {
    const res = await app.request("/api/messages");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates a scheduled message", async () => {
    const res = await jsonRequest(app, "/api/messages", "POST", validOnce());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.body).toBe("hello");
    expect(body.scheduleKind).toBe("once");
    expect(body.nextRunAt).not.toBeNull();
    expect(body.userId).toBe(TEST_USER_ID);
  });

  it("rejects invalid input with 400", async () => {
    const res = await jsonRequest(app, "/api/messages", "POST", { recipient: "" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown message id", async () => {
    const res = await app.request("/api/messages/00000000-0000-4000-8000-000000000999");
    expect(res.status).toBe(404);
  });

  it("returns 400 for a malformed UUID param", async () => {
    const res = await app.request("/api/messages/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("updates a scheduled message via PUT", async () => {
    const created = await jsonRequest(app, "/api/messages", "POST", validOnce()).then((r) =>
      r.json()
    );
    const res = await jsonRequest(app, `/api/messages/${created.id}`, "PUT", {
      ...validOnce(),
      body: "updated"
    });
    expect(res.status).toBe(200);
    expect((await res.json()).body).toBe("updated");
  });

  it("toggles a schedule via PATCH and re-arms nextRunAt", async () => {
    const created = await jsonRequest(app, "/api/messages", "POST", validOnce()).then((r) =>
      r.json()
    );
    const off = await jsonRequest(app, `/api/messages/${created.id}`, "PATCH", { enabled: false });
    expect(off.status).toBe(200);
    expect((await off.json()).enabled).toBe(false);

    const on = await jsonRequest(app, `/api/messages/${created.id}`, "PATCH", { enabled: true });
    expect(on.status).toBe(200);
    const body = await on.json();
    expect(body.enabled).toBe(true);
    expect(body.nextRunAt).not.toBeNull();
  });

  it("deletes a scheduled message", async () => {
    const created = await jsonRequest(app, "/api/messages", "POST", validOnce()).then((r) =>
      r.json()
    );
    const del = await app.request(`/api/messages/${created.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect((await del.json()).ok).toBe(true);

    const after = await app.request(`/api/messages/${created.id}`);
    expect(after.status).toBe(404);
  });

  it("send-now enqueues a delivery via pg-boss", async () => {
    const res = await jsonRequest(app, "/api/messages/send-now", "POST", {
      recipientType: "contact",
      recipient: "+15555550100",
      body: "now"
    });
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(typeof body.deliveryId).toBe("string");
    expect(boss.send).toHaveBeenCalledWith(
      "send-message",
      expect.objectContaining({ deliveryId: body.deliveryId, body: "now" })
    );
  });

  it("send-now rejects an empty body", async () => {
    const res = await jsonRequest(app, "/api/messages/send-now", "POST", {
      recipientType: "contact",
      recipient: "+15555550100",
      body: ""
    });
    expect(res.status).toBe(400);
  });
});
