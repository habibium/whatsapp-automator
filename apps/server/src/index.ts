import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { logger } from "@pkg/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { testConnection } from "./db/index.js";
import { auth } from "./lib/auth.js";
import { rateLimiter } from "./middleware/rate-limit.js";
import { messagesRoutes } from "./routes/messages.js";
import { whatsappRoutes } from "./routes/whatsapp.js";
import { schedulerService } from "./services/scheduler.js";
import { whatsappService } from "./services/whatsapp.js";

const app = new Hono();

// Global error handler — never leak internal details
app.onError((err, c) => {
  logger.error({ err: err.message, path: c.req.path }, "Unhandled error");
  return c.json({ success: false, error: "Internal server error" }, 500);
});

import { isAllowedOrigin } from "./lib/origins.js";

// CORS configuration
app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (!origin) return "http://localhost:3000";
      return isAllowedOrigin(origin) ? origin : null;
    },
    credentials: true
  })
);

// Rate limiting — stricter for auth, lighter for general API
const authLimiter = rateLimiter({ max: 10, windowMs: 60_000 }); // 10 req/min per IP
const apiLimiter = rateLimiter({ max: 60, windowMs: 60_000 }); // 60 req/min per IP

app.use("/api/auth/*", authLimiter);
app.use("/api/messages/*", apiLimiter);
app.use("/api/whatsapp/*", apiLimiter);

// API routes — Better Auth handler
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.route("/api/whatsapp", whatsappRoutes);
app.route("/api/messages", messagesRoutes);

// Health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Server timezone info
app.get("/api/timezone", (c) => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = -new Date().getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absH = Math.floor(Math.abs(offset) / 60);
  const absM = Math.abs(offset) % 60;
  const gmt = `GMT${sign}${absH}${absM > 0 ? `:${String(absM).padStart(2, "0")}` : ""}`;
  return c.json({ timezone: tz, offset: gmt });
});

// Serve static files for production
const staticDir = process.env["WEB_DIST_DIR"] ?? join(process.cwd(), "../web/dist");

app.get("*", async (c) => {
  const path = c.req.path === "/" ? "/index.html" : c.req.path;
  const filePath = join(staticDir, path);

  try {
    const content = await readFile(filePath);
    const ext = path.split(".").pop() ?? "";
    const contentTypes: Record<string, string> = {
      html: "text/html",
      js: "application/javascript",
      css: "text/css",
      json: "application/json",
      png: "image/png",
      jpg: "image/jpeg",
      svg: "image/svg+xml",
      ico: "image/x-icon"
    };
    return c.body(content, 200, {
      "Content-Type": contentTypes[ext] ?? "application/octet-stream"
    });
  } catch {
    // Fallback to index.html for SPA routing
    try {
      const indexContent = await readFile(join(staticDir, "index.html"));
      return c.body(indexContent, 200, { "Content-Type": "text/html" });
    } catch {
      return c.text("Not Found", 404);
    }
  }
});

async function main() {
  // Test database connection
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.error("Failed to connect to database. Exiting.");
    process.exit(1);
  }

  // Load all schedules
  await schedulerService.loadAllSchedules();

  const port = Number(process.env["PORT"]) || 3000;

  serve({ fetch: app.fetch, port }, (info) => {
    logger.info({ port: info.port }, "Server started");
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Shutting down...");
  schedulerService.shutdown();
  await whatsappService.shutdown();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Shutting down...");
  schedulerService.shutdown();
  await whatsappService.shutdown();
  process.exit(0);
});

main();
