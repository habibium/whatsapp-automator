import type { Context, Next } from "hono";
import { auth, type Session } from "../lib/auth.js";

export type AuthContext = {
  Variables: {
    user: Session["user"];
    session: Session["session"];
  };
};

export async function authMiddleware(c: Context<AuthContext>, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);

  return next();
}
