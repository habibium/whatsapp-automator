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
import { whatsappService } from "../../src/whatsapp/service";
import { resetDb, seedTestUser } from "../helpers/db";

beforeEach(async () => {
  vi.clearAllMocks();
  await resetDb();
  await seedTestUser();
});

describe("whatsapp routes", () => {
  it("returns the service status", async () => {
    vi.mocked(whatsappService.getStatus).mockReturnValue({
      status: "connected",
      qr: null,
      phoneNumber: "+15555550100"
    });
    const res = await app.request("/api/whatsapp/status");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "connected",
      qr: null,
      phoneNumber: "+15555550100"
    });
    expect(whatsappService.getStatus).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("connect calls the service then returns status", async () => {
    vi.mocked(whatsappService.getStatus).mockReturnValue({
      status: "connecting",
      qr: null,
      phoneNumber: null
    });
    const res = await app.request("/api/whatsapp/connect", { method: "POST" });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("connecting");
    expect(whatsappService.connect).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("disconnect calls the service", async () => {
    vi.mocked(whatsappService.getStatus).mockReturnValue({
      status: "disconnected",
      qr: null,
      phoneNumber: null
    });
    const res = await app.request("/api/whatsapp/disconnect", { method: "POST" });
    expect(res.status).toBe(200);
    expect(whatsappService.disconnect).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("logout calls the service", async () => {
    vi.mocked(whatsappService.getStatus).mockReturnValue({
      status: "disconnected",
      qr: null,
      phoneNumber: null
    });
    const res = await app.request("/api/whatsapp/logout", { method: "POST" });
    expect(res.status).toBe(200);
    expect(whatsappService.logout).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("groups returns the service result", async () => {
    vi.mocked(whatsappService.listGroups).mockResolvedValue([
      { id: "g1@g.us", name: "Family" },
      { id: "g2@g.us", name: "Work" }
    ]);
    const res = await app.request("/api/whatsapp/groups");
    expect(res.status).toBe(200);
    expect((await res.json()).map((g: { name: string }) => g.name)).toEqual(["Family", "Work"]);
  });
});
