import { idParamSchema, templateInputSchema } from "@pkg/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { type AuthVariables, requireAuth } from "../auth/middleware";
import {
  createTemplate,
  deleteTemplate,
  findTemplate,
  listTemplates,
  updateTemplate
} from "../db/repositories/templates";
import { serializeTemplate } from "../lib/serializers";

/** Reusable message template CRUD. */
export const templateRoutes = new Hono<{ Variables: AuthVariables }>()
  .use(requireAuth)
  .get("/", async (c) => {
    const rows = await listTemplates(c.get("user").id);
    return c.json(rows.map(serializeTemplate));
  })
  .post("/", zValidator("json", templateInputSchema), async (c) => {
    const row = await createTemplate(c.get("user").id, c.req.valid("json"));
    return c.json(serializeTemplate(row), 201);
  })
  .get("/:id", zValidator("param", idParamSchema), async (c) => {
    const row = await findTemplate(c.req.valid("param").id, c.get("user").id);
    if (!row) return c.json({ error: "Template not found" }, 404);
    return c.json(serializeTemplate(row));
  })
  .put(
    "/:id",
    zValidator("param", idParamSchema),
    zValidator("json", templateInputSchema),
    async (c) => {
      const user = c.get("user");
      const row = await updateTemplate(c.req.valid("param").id, user.id, c.req.valid("json"));
      if (!row) return c.json({ error: "Template not found" }, 404);
      return c.json(serializeTemplate(row));
    }
  )
  .delete("/:id", zValidator("param", idParamSchema), async (c) => {
    const deleted = await deleteTemplate(c.req.valid("param").id, c.get("user").id);
    if (!deleted) return c.json({ error: "Template not found" }, 404);
    return c.json({ ok: true });
  });
