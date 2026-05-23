import { PgBoss } from "pg-boss";
import { env } from "../env";

/** Queue that delivers individual messages. */
export const SEND_QUEUE = "send-message";

/** Queue fired once per minute to dispatch due scheduled messages. */
export const TICK_QUEUE = "scheduler-tick";

/**
 * Postgres-backed durable job queue. Jobs survive process restarts and
 * failed deliveries are retried automatically.
 */
export const boss = new PgBoss(env.DATABASE_URL);
