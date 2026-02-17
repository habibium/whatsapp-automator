/**
 * Shared origin validation used by both Hono CORS and Better Auth trustedOrigins.
 * Single source of truth so they never drift.
 */

const staticOrigins = new Set(["http://localhost:5173", "http://localhost:3000"]);

// Additional origins from CORS_ORIGINS env var (comma-separated)
const envOrigins =
  process.env["CORS_ORIGINS"]
    ?.split(",")
    .map((o) => o.trim())
    .filter(Boolean) ?? [];

for (const o of envOrigins) {
  staticOrigins.add(o);
}

/** RFC 1918 private-network pattern — 192.168.x.x / 10.x.x.x on dev ports */
const privateNetworkRe =
  /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}):(3000|5173)$/;

/** Check if an origin is allowed (used by Hono CORS) */
export function isAllowedOrigin(origin: string): boolean {
  if (staticOrigins.has(origin)) return true;
  return privateNetworkRe.test(origin);
}

/** Return the origin in an array if allowed, empty array otherwise (used by Better Auth trustedOrigins) */
export function getAllowedOrigins(origin: string): string[] {
  return isAllowedOrigin(origin) ? [origin] : [];
}
