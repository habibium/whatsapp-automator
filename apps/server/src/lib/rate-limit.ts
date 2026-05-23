import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { env } from "../env";

type Bucket = { count: number; resetAt: number };

/** Resolves the client identifier used to bucket requests. */
function clientKey(c: Context): string {
  if (env.TRUST_PROXY) {
    const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    // `getConnInfo` requires a Node server context — absent under `app.request()` in tests.
    return "unknown";
  }
}

/**
 * Fixed-window in-memory rate limiter. Adequate for a single-instance
 * deployment; a multi-instance deployment would back this with Redis.
 */
export function rateLimiter(options: { limit: number; windowMs: number }): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();

  return createMiddleware(async (c, next) => {
    const now = Date.now();
    const key = clientKey(c);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (bucket.count > options.limit) {
      c.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return c.json({ error: "Too many requests" }, 429);
    }

    // Opportunistically evict expired buckets to bound memory.
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }

    return next();
  });
}
