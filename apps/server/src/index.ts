import { serve } from "@hono/node-server";
import { app } from "./app";
import { checkDatabaseConnection, closeDatabase } from "./db/client";
import { runMigrations } from "./db/migrate";
import { env } from "./env";
import { logger } from "./logger";
import { startScheduler, stopScheduler } from "./scheduler";
import { whatsappService } from "./whatsapp/service";

async function bootstrap(): Promise<void> {
  if (!(await checkDatabaseConnection())) {
    logger.fatal("Cannot reach the database — exiting");
    process.exit(1);
  }

  await runMigrations();
  await startScheduler();

  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    logger.info({ port: info.port, env: env.NODE_ENV }, "Server listening");
  });

  // Reconnect paired WhatsApp sessions in the background — don't delay readiness.
  void whatsappService.connectAll();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down gracefully");
    server.close();
    await whatsappService.shutdown();
    await stopScheduler();
    await closeDatabase();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

bootstrap().catch((err) => {
  logger.fatal({ err }, "Fatal error during startup");
  process.exit(1);
});
