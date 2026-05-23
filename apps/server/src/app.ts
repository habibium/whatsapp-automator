import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth/auth";
import { checkDatabaseConnection } from "./db/client";
import { env, isProduction } from "./env";
import { rateLimiter } from "./lib/rate-limit";
import { logger } from "./logger";
import { deliveryRoutes } from "./routes/deliveries";
import { messageRoutes } from "./routes/messages";
import { templateRoutes } from "./routes/templates";
import { whatsappRoutes } from "./routes/whatsapp";

const app = new Hono();

app.onError((err, c) => {
  logger.error({ err, path: c.req.path }, "Unhandled request error");
  return c.json({ error: "Internal server error" }, 500);
});

// Same-origin in production; the Vite dev server proxies /api in development.
app.use("/api/*", cors({ origin: env.APP_URL, credentials: true }));
app.use("/api/*", rateLimiter({ limit: 120, windowMs: 60_000 }));

// Better Auth owns every /api/auth/* route.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/api/health", async (c) => {
  const databaseOk = await checkDatabaseConnection();
  return databaseOk ? c.json({ status: "ok" }) : c.json({ status: "degraded" }, 503);
});

// Application routes — chained so the Hono RPC client can infer their types.
const api = new Hono()
  .route("/whatsapp", whatsappRoutes)
  .route("/messages", messageRoutes)
  .route("/templates", templateRoutes)
  .route("/deliveries", deliveryRoutes);

app.route("/api", api);

// Unmatched API paths return JSON rather than the SPA shell.
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// In production the server also serves the built web client.
if (isProduction) {
  app.use("*", serveStatic({ root: env.WEB_DIST_DIR }));
  app.get("*", serveStatic({ path: `${env.WEB_DIST_DIR}/index.html` }));
}

export { app };

/** Type surface consumed by the web client's Hono RPC client. */
export type AppType = typeof api;
