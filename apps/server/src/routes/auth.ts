import { hash, verify } from "@node-rs/argon2";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { createSession, createUser, deleteSession, getUserByEmail } from "../db/queries.js";
import { type AuthContext, authMiddleware } from "../middleware/auth.js";

// Only set Secure cookie flag when explicitly enabled (requires HTTPS)
const secureCookie = process.env["COOKIE_SECURE"] === "true";

export const authRoutes = new Hono<AuthContext>();

// Register new user
authRoutes.post("/register", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();

  if (!body.email || !body.password) {
    return c.json({ success: false, error: "Email and password are required" }, 400);
  }

  const email = body.email.toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ success: false, error: "Invalid email format" }, 400);
  }

  if (body.password.length < 8) {
    return c.json({ success: false, error: "Password must be at least 8 characters" }, 400);
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    return c.json({ success: false, error: "Email already registered" }, 400);
  }

  const passwordHash = await hash(body.password);
  const user = await createUser(email, passwordHash);

  // Create session
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const session = await createSession(user.id, expiresAt);

  setCookie(c, "session", session.id, {
    path: "/",
    httpOnly: true,
    secure: secureCookie,
    sameSite: "Lax",
    expires: expiresAt
  });

  return c.json({
    success: true,
    data: { id: user.id, email: user.email, createdAt: user.createdAt }
  });
});

// Login
authRoutes.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();

  if (!body.email || !body.password) {
    return c.json({ success: false, error: "Email and password are required" }, 400);
  }

  const email = body.email.toLowerCase().trim();
  const user = await getUserByEmail(email);

  if (!user) {
    return c.json({ success: false, error: "Invalid credentials" }, 401);
  }

  const validPassword = await verify(user.passwordHash, body.password);
  if (!validPassword) {
    return c.json({ success: false, error: "Invalid credentials" }, 401);
  }

  // Create session
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  const session = await createSession(user.id, expiresAt);

  setCookie(c, "session", session.id, {
    path: "/",
    httpOnly: true,
    secure: secureCookie,
    sameSite: "Lax",
    expires: expiresAt
  });

  return c.json({
    success: true,
    data: { id: user.id, email: user.email, createdAt: user.createdAt }
  });
});

// Logout
authRoutes.post("/logout", authMiddleware, async (c) => {
  const sessionId = c.get("sessionId");
  await deleteSession(sessionId);
  deleteCookie(c, "session", { path: "/" });
  return c.json({ success: true, data: null });
});

// Get current user
authRoutes.get("/me", authMiddleware, (c) => {
  const user = c.get("user");
  return c.json({
    success: true,
    data: { id: user.id, email: user.email, createdAt: user.createdAt }
  });
});
