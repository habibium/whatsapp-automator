import { Hono } from "hono";
import cron from "node-cron";
import {
  createScheduledMessage,
  deleteScheduledMessage,
  getScheduledMessageById,
  getScheduledMessages,
  updateScheduledMessage
} from "../db/queries.js";
import { type AuthContext, authMiddleware } from "../middleware/auth.js";
import { schedulerService } from "../services/scheduler.js";

export const messagesRoutes = new Hono<AuthContext>();

// All routes require authentication
messagesRoutes.use("/*", authMiddleware);

// List all scheduled messages for user
messagesRoutes.get("/", async (c) => {
  const user = c.get("user");
  const messages = await getScheduledMessages(user.id);
  return c.json({ success: true, data: messages });
});

// Get single message
messagesRoutes.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const message = await getScheduledMessageById(id, user.id);

  if (!message) {
    return c.json({ success: false, error: "Message not found" }, 404);
  }

  return c.json({ success: true, data: message });
});

// Create new scheduled message
messagesRoutes.post("/", async (c) => {
  const user = c.get("user");

  let body: {
    target?: string;
    isGroup?: boolean;
    message?: string;
    cronExpression?: string;
    enabled?: boolean;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const target = typeof body.target === "string" ? body.target.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const cronExpression = typeof body.cronExpression === "string" ? body.cronExpression.trim() : "";

  if (!target || !message || !cronExpression) {
    return c.json(
      { success: false, error: "target, message, and cronExpression are required" },
      400
    );
  }

  if (target.length > 255) {
    return c.json({ success: false, error: "target must be 255 characters or less" }, 400);
  }

  if (message.length > 10_000) {
    return c.json({ success: false, error: "message must be 10,000 characters or less" }, 400);
  }

  if (!cron.validate(cronExpression)) {
    return c.json({ success: false, error: "Invalid cron expression" }, 400);
  }

  const message_ = await createScheduledMessage(user.id, {
    target,
    isGroup: body.isGroup === true,
    message,
    cronExpression,
    enabled: body.enabled !== false
  });

  // Update scheduler
  schedulerService.updateSchedule(message_);

  return c.json({ success: true, data: message_ }, 201);
});

// Update scheduled message
messagesRoutes.put("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  let body: {
    target?: string;
    isGroup?: boolean;
    message?: string;
    cronExpression?: string;
    enabled?: boolean;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const existing = await getScheduledMessageById(id, user.id);
  if (!existing) {
    return c.json({ success: false, error: "Message not found" }, 404);
  }

  if (typeof body.target === "string" && body.target.trim().length > 255) {
    return c.json({ success: false, error: "target must be 255 characters or less" }, 400);
  }
  if (typeof body.message === "string" && body.message.trim().length > 10_000) {
    return c.json({ success: false, error: "message must be 10,000 characters or less" }, 400);
  }

  if (body.cronExpression && !cron.validate(body.cronExpression)) {
    return c.json({ success: false, error: "Invalid cron expression" }, 400);
  }

  // Sanitize update payload — only allow known fields with correct types
  const updateData: Partial<{
    target: string;
    isGroup: boolean;
    message: string;
    cronExpression: string;
    enabled: boolean;
  }> = {};
  if (typeof body.target === "string") updateData.target = body.target.trim();
  if (typeof body.isGroup === "boolean") updateData.isGroup = body.isGroup;
  if (typeof body.message === "string") updateData.message = body.message.trim();
  if (typeof body.cronExpression === "string")
    updateData.cronExpression = body.cronExpression.trim();
  if (typeof body.enabled === "boolean") updateData.enabled = body.enabled;

  const updated = await updateScheduledMessage(id, user.id, updateData);

  if (updated) {
    schedulerService.updateSchedule(updated);
  }

  return c.json({ success: true, data: updated });
});

// Delete scheduled message
messagesRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const deleted = await deleteScheduledMessage(id, user.id);
  if (!deleted) {
    return c.json({ success: false, error: "Message not found" }, 404);
  }

  schedulerService.removeSchedule(id);

  return c.json({ success: true, data: null });
});
