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
import { resetDb, seedTestUser } from "../helpers/db";
import { jsonRequest } from "../helpers/http";

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDb();
  await seedTestUser();
});

describe("template routes", () => {
  it("lists empty initially", async () => {
    const res = await app.request("/api/templates");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("creates, updates and deletes a template", async () => {
    const create = await jsonRequest(app, "/api/templates", "POST", {
      name: "Greeting",
      body: "Hello"
    });
    expect(create.status).toBe(201);
    const created = await create.json();
    expect(created.name).toBe("Greeting");

    const update = await jsonRequest(app, `/api/templates/${created.id}`, "PUT", {
      name: "Greeting v2",
      body: "Hi"
    });
    expect(update.status).toBe(200);
    expect((await update.json()).name).toBe("Greeting v2");

    const del = await app.request(`/api/templates/${created.id}`, { method: "DELETE" });
    expect(del.status).toBe(200);

    const after = await app.request(`/api/templates/${created.id}`);
    expect(after.status).toBe(404);
  });

  it("validates required fields", async () => {
    const res = await jsonRequest(app, "/api/templates", "POST", { name: "", body: "" });
    expect(res.status).toBe(400);
  });
});
