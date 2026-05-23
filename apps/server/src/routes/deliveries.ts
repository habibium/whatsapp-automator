import { listQuerySchema } from "@pkg/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { type AuthVariables, requireAuth } from "../auth/middleware";
import { listDeliveries } from "../db/repositories/deliveries";
import { serializeDelivery } from "../lib/serializers";

/** Read-only delivery history. */
export const deliveryRoutes = new Hono<{ Variables: AuthVariables }>()
  .use(requireAuth)
  .get("/", zValidator("query", listQuerySchema), async (c) => {
    const { limit, offset } = c.req.valid("query");
    const { items, total } = await listDeliveries(c.get("user").id, { limit, offset });
    return c.json({ items: items.map(serializeDelivery), total, limit, offset });
  });
