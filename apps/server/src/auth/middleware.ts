import { createMiddleware } from "hono/factory";
import { type AuthUser, auth, type Session } from "./auth";

/** Hono context variables populated by {@link requireAuth}. */
export type AuthVariables = {
  user: AuthUser;
  session: Session["session"];
};

/**
 * Guards a route group: rejects unauthenticated requests with 401, otherwise
 * exposes the authenticated user and session on the request context.
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!result) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", result.user);
  c.set("session", result.session);
  return next();
});
