import {
  idParamSchema,
  type ScheduledMessageInput,
  scheduledMessageInputSchema,
  sendNowSchema,
  toggleSchema
} from "@pkg/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { type AuthVariables, requireAuth } from "../auth/middleware";
import type {
  ScheduledMessageInsert,
  ScheduledMessagePatch
} from "../db/repositories/scheduled-messages";
import {
  createScheduledMessage,
  deleteScheduledMessage,
  findScheduledMessage,
  listScheduledMessages,
  updateScheduledMessage
} from "../db/repositories/scheduled-messages";
import { serializeScheduledMessage } from "../lib/serializers";
import { enqueueSend, initialNextRun } from "../scheduler";

/** Maps validated API input to the persisted column shape, computing `nextRunAt`. */
function toScheduleFields(input: ScheduledMessageInput): Omit<ScheduledMessageInsert, "userId"> {
  const runAt = input.scheduleKind === "once" && input.runAt ? new Date(input.runAt) : null;
  const cron = input.scheduleKind === "recurring" ? (input.cron ?? null) : null;
  const nextRunAt = input.enabled
    ? initialNextRun({ scheduleKind: input.scheduleKind, runAt, cron, timezone: input.timezone })
    : null;
  return {
    recipientType: input.recipientType,
    recipient: input.recipient,
    recipientName: input.recipientName ?? null,
    body: input.body,
    scheduleKind: input.scheduleKind,
    runAt,
    cron,
    timezone: input.timezone,
    templateId: input.templateId ?? null,
    enabled: input.enabled,
    nextRunAt
  };
}

/** Scheduled message CRUD plus the ad-hoc "send now" endpoint. */
export const messageRoutes = new Hono<{ Variables: AuthVariables }>()
  .use(requireAuth)
  .get("/", async (c) => {
    const rows = await listScheduledMessages(c.get("user").id);
    return c.json(rows.map(serializeScheduledMessage));
  })
  .post("/send-now", zValidator("json", sendNowSchema), async (c) => {
    const user = c.get("user");
    const input = c.req.valid("json");
    const deliveryId = await enqueueSend({
      userId: user.id,
      scheduledMessageId: null,
      recipientType: input.recipientType,
      recipient: input.recipient,
      recipientName: input.recipientName ?? null,
      body: input.body
    });
    return c.json({ deliveryId }, 202);
  })
  .post("/", zValidator("json", scheduledMessageInputSchema), async (c) => {
    const user = c.get("user");
    const row = await createScheduledMessage({
      userId: user.id,
      ...toScheduleFields(c.req.valid("json"))
    });
    return c.json(serializeScheduledMessage(row), 201);
  })
  .get("/:id", zValidator("param", idParamSchema), async (c) => {
    const row = await findScheduledMessage(c.req.valid("param").id, c.get("user").id);
    if (!row) return c.json({ error: "Scheduled message not found" }, 404);
    return c.json(serializeScheduledMessage(row));
  })
  .put(
    "/:id",
    zValidator("param", idParamSchema),
    zValidator("json", scheduledMessageInputSchema),
    async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      if (!(await findScheduledMessage(id, user.id))) {
        return c.json({ error: "Scheduled message not found" }, 404);
      }
      const row = await updateScheduledMessage(id, user.id, toScheduleFields(c.req.valid("json")));
      return c.json(serializeScheduledMessage(row!));
    }
  )
  .patch(
    "/:id",
    zValidator("param", idParamSchema),
    zValidator("json", toggleSchema),
    async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const existing = await findScheduledMessage(id, user.id);
      if (!existing) return c.json({ error: "Scheduled message not found" }, 404);

      const { enabled } = c.req.valid("json");
      // Re-arm the next run time when a schedule is switched back on.
      const patch: ScheduledMessagePatch = enabled
        ? {
            enabled,
            nextRunAt: initialNextRun({
              scheduleKind: existing.scheduleKind,
              runAt: existing.runAt,
              cron: existing.cron,
              timezone: existing.timezone
            })
          }
        : { enabled };
      const row = await updateScheduledMessage(id, user.id, patch);
      return c.json(serializeScheduledMessage(row!));
    }
  )
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const deleted = await deleteScheduledMessage(c.req.valid("param").id, c.get("user").id);
    if (!deleted) return c.json({ error: "Scheduled message not found" }, 404);
    return c.json({ ok: true });
  });
