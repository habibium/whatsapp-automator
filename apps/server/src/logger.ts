import { pino } from "pino";
import { env, isProduction, isTest } from "./env";

/**
 * Application logger. Pretty-printed in development, JSON in production,
 * silent during tests to keep test output clean.
 */
export const logger = pino({
  level: isTest ? "silent" : isProduction ? "info" : "debug",
  ...(isProduction || isTest
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" }
        }
      })
});

export type Logger = typeof logger;

// Reference env so the module participates in the env-validated graph.
void env;
