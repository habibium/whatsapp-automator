import type { AppType } from "@app/server/app-type";
import { hc } from "hono/client";

/**
 * Typed Hono RPC client. Routes, request inputs and response shapes are
 * inferred directly from the server's `AppType` — no codegen, no drift.
 */
export const client = hc<AppType>(`${window.location.origin}/api`);
