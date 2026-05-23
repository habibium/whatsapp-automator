import { Hono } from "hono";
import { type AuthVariables, requireAuth } from "../auth/middleware";
import { whatsappService } from "../whatsapp/service";

/** WhatsApp connection management — pairing, status, groups. */
export const whatsappRoutes = new Hono<{ Variables: AuthVariables }>()
  .use(requireAuth)
  .get("/status", (c) => {
    return c.json(whatsappService.getStatus(c.get("user").id));
  })
  .post("/connect", async (c) => {
    const userId = c.get("user").id;
    await whatsappService.connect(userId);
    return c.json(whatsappService.getStatus(userId));
  })
  .post("/disconnect", async (c) => {
    const userId = c.get("user").id;
    await whatsappService.disconnect(userId);
    return c.json(whatsappService.getStatus(userId));
  })
  .post("/logout", async (c) => {
    const userId = c.get("user").id;
    await whatsappService.logout(userId);
    return c.json(whatsappService.getStatus(userId));
  })
  .get("/groups", async (c) => {
    return c.json(await whatsappService.listGroups(c.get("user").id));
  });
