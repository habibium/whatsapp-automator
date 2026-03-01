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
    scheduleType?: string;
    cronExpression?: string;
    scheduledAt?: string;
    enabled?: boolean;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const target = typeof body.target === "string" ? body.target.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const scheduleType = body.scheduleType === "once" ? "once" : "recurring";

  if (!target || !message) {
    return c.json({ success: false, error: "target and message are required" }, 400);
  }

  if (target.length > 255) {
    return c.json({ success: false, error: "target must be 255 characters or less" }, 400);
  }

  if (message.length > 10_000) {
    return c.json({ success: false, error: "message must be 10,000 characters or less" }, 400);
  }

  // Validate based on schedule type
  if (scheduleType === "once") {
    if (!body.scheduledAt) {
      return c.json(
        { success: false, error: "scheduledAt is required for one-time schedules" },
        400
      );
    }
    const scheduledDate = new Date(body.scheduledAt);
    if (Number.isNaN(scheduledDate.getTime())) {
      return c.json({ success: false, error: "Invalid scheduledAt date" }, 400);
    }
    if (scheduledDate.getTime() <= Date.now()) {
      return c.json({ success: false, error: "scheduledAt must be in the future" }, 400);
    }

    const message_ = await createScheduledMessage(user.id, {
      target,
      isGroup: body.isGroup === true,
      message,
      scheduleType: "once",
      cronExpression: null,
      scheduledAt: scheduledDate,
      enabled: body.enabled !== false
    });

    schedulerService.updateSchedule(message_);
    return c.json({ success: true, data: message_ }, 201);
  }

  // Recurring schedule
  const cronExpression = typeof body.cronExpression === "string" ? body.cronExpression.trim() : "";
  if (!cronExpression) {
    return c.json(
      { success: false, error: "cronExpression is required for recurring schedules" },
      400
    );
  }

  if (!cron.validate(cronExpression)) {
    return c.json({ success: false, error: "Invalid cron expression" }, 400);
  }

  const message_ = await createScheduledMessage(user.id, {
    target,
    isGroup: body.isGroup === true,
    message,
    scheduleType: "recurring",
    cronExpression,
    scheduledAt: null,
    enabled: body.enabled !== false
  });

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
    scheduleType?: string;
    cronExpression?: string;
    scheduledAt?: string | null;
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

  // Determine effective schedule type (use new value or keep existing)
  const effectiveScheduleType =
    body.scheduleType === "once" || body.scheduleType === "recurring"
      ? body.scheduleType
      : existing.scheduleType;

  if (effectiveScheduleType === "once" && body.scheduledAt !== undefined) {
    if (body.scheduledAt !== null) {
      const scheduledDate = new Date(body.scheduledAt);
      if (Number.isNaN(scheduledDate.getTime())) {
        return c.json({ success: false, error: "Invalid scheduledAt date" }, 400);
      }
    }
  }

  if (effectiveScheduleType === "recurring" && body.cronExpression) {
    if (!cron.validate(body.cronExpression)) {
      return c.json({ success: false, error: "Invalid cron expression" }, 400);
    }
  }

  // Sanitize update payload
  const updateData: Partial<{
    target: string;
    isGroup: boolean;
    message: string;
    scheduleType: string;
    cronExpression: string | null;
    scheduledAt: Date | null;
    enabled: boolean;
  }> = {};

  if (typeof body.target === "string") updateData.target = body.target.trim();
  if (typeof body.isGroup === "boolean") updateData.isGroup = body.isGroup;
  if (typeof body.message === "string") updateData.message = body.message.trim();
  if (typeof body.enabled === "boolean") updateData.enabled = body.enabled;

  if (body.scheduleType === "once" || body.scheduleType === "recurring") {
    updateData.scheduleType = body.scheduleType;
  }

  if (effectiveScheduleType === "once") {
    if (body.scheduledAt !== undefined) {
      updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    }
    // Clear cron when switching to once
    if (body.scheduleType === "once") {
      updateData.cronExpression = null;
    }
  } else {
    if (typeof body.cronExpression === "string") {
      updateData.cronExpression = body.cronExpression.trim();
    }
    // Clear scheduledAt when switching to recurring
    if (body.scheduleType === "recurring") {
      updateData.scheduledAt = null;
    }
  }

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
