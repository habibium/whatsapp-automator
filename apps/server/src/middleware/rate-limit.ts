import type { Context, Next } from "hono";

type RateLimitOptions = {
  /** Max requests per window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Key extractor — defaults to IP-based */
  keyGenerator?: (c: Context) => string;
  /** Custom response message */
  message?: string;
};

type Entry = {
  count: number;
  resetAt: number;
};

const stores = new Map<string, Map<string, Entry>>();

/** Periodically clean expired entries (every 60s) */
setInterval(() => {
  const now = Date.now();
  for (const store of stores.values()) {
    for (const [key, entry] of store) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }
}, 60_000).unref();

/**
 * Simple in-memory rate limiter middleware for Hono.
 * Uses a sliding window counter keyed by IP address.
 */
export function rateLimiter(opts: RateLimitOptions) {
  const { max, windowMs, message = "Too many requests, please try again later" } = opts;

  // Each rateLimiter() call gets its own store so different routes have independent limits
  const id = `rl-${Math.random().toString(36).slice(2)}`;
  const store = new Map<string, Entry>();
  stores.set(id, store);

  const keyGen =
    opts.keyGenerator ??
    ((c: Context) => {
      // Use X-Forwarded-For if behind a proxy, otherwise fall back to remote address
      return (
        c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
        c.req.header("x-real-ip") ??
        "unknown"
      );
    });

  return async (c: Context, next: Next) => {
    const key = keyGen(c);
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    // Set standard rate-limit headers
    const remaining = Math.max(0, max - entry.count);
    c.header("X-RateLimit-Limit", String(max));
    c.header("X-RateLimit-Remaining", String(remaining));
    c.header("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      c.header("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ success: false, error: message }, 429);
    }

    return next();
  };
}
