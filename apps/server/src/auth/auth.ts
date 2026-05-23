import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/client";
import { passwordResetEmail, verificationEmail } from "../email/templates";
import { sendEmail } from "../email/email";
import { env, isProduction } from "../env";
import { logger } from "../logger";

/** Origins permitted to make authenticated requests (CSRF protection). */
const trustedOrigins = isProduction
  ? [env.APP_URL]
  : [...new Set([env.APP_URL, "http://localhost:5173", "http://localhost:3000"])];

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      logger.info({ email: user.email }, "Sending password reset email");
      await sendEmail({
        to: user.email,
        subject: "Reset your password — WA Scheduler",
        html: passwordResetEmail(url)
      });
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      logger.info({ email: user.email }, "Sending verification email");
      await sendEmail({
        to: user.email,
        subject: "Verify your email — WA Scheduler",
        html: verificationEmail(url)
      });
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh daily
    cookieCache: { enabled: true, maxAge: 5 * 60 }
  },
  advanced: {
    cookiePrefix: "wa-scheduler",
    useSecureCookies: isProduction
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100
  }
});

export type Session = typeof auth.$Infer.Session;
export type AuthUser = Session["user"];
