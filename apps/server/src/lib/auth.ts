import { logger } from "@pkg/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/index.js";
import { sendEmail } from "./email.js";

import { getAllowedOrigins } from "./origins.js";

const baseURL = process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000";
const appURL = process.env["APP_URL"] ?? baseURL;

export const auth = betterAuth({
  baseURL,
  basePath: "/api/auth",
  secret: process.env["BETTER_AUTH_SECRET"],
  database: drizzleAdapter(db, {
    provider: "pg"
  }),
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin");
    return origin ? getAllowedOrigins(origin) : [];
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false, // Don't auto sign-in; require email verification first
    sendResetPassword: async ({ user, url }) => {
      // Rewrite the URL so it points to the frontend app, not the API server
      const resetUrl = url.replace(baseURL, appURL);
      logger.info({ email: user.email }, "Sending password reset email");
      await sendEmail({
        to: user.email,
        subject: "Reset your password — WA Scheduler",
        html: passwordResetTemplate(resetUrl)
      });
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, token }) => {
      // Point to the frontend verification page instead of the raw API endpoint.
      // The frontend page calls the API, handles errors gracefully, and
      // auto-signs the user in after successful verification.
      const verificationUrl = `${appURL}/verify-email?token=${token}`;
      logger.info({ email: user.email }, "Sending verification email");
      await sendEmail({
        to: user.email,
        subject: "Verify your email — WA Scheduler",
        html: verificationTemplate(verificationUrl)
      });
    }
  },
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // refresh session every 24h
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minute cookie cache
    }
  },
  advanced: {
    cookiePrefix: "wa-scheduler",
    // Use secure cookies in production (requires HTTPS)
    useSecureCookies: process.env["NODE_ENV"] === "production"
  }
});

export type Session = typeof auth.$Infer.Session;

// ── Email Templates ────────────────────────────────────────────────

function verificationTemplate(url: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #16a34a; border-radius: 12px;">
          <span style="font-size: 24px; color: white;">📅</span>
        </div>
        <h1 style="margin: 16px 0 4px; font-size: 22px; font-weight: 700;">WA Scheduler</h1>
      </div>
      <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 12px;">Verify your email address</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #525252; margin: 0 0 24px;">
        Thanks for signing up! Click the button below to verify your email and activate your account.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${url}" style="display: inline-block; padding: 12px 32px; background: #16a34a; color: white; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
          Verify Email
        </a>
      </div>
      <p style="font-size: 12px; color: #a3a3a3; margin: 24px 0 0;">
        If you didn't create an account, you can safely ignore this email. This link expires in 1 hour.
      </p>
    </div>
  `;
}

function passwordResetTemplate(url: string): string {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; color: #1a1a1a;">
      <div style="text-align: center; margin-bottom: 32px;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #16a34a; border-radius: 12px;">
          <span style="font-size: 24px; color: white;">📅</span>
        </div>
        <h1 style="margin: 16px 0 4px; font-size: 22px; font-weight: 700;">WA Scheduler</h1>
      </div>
      <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 12px;">Reset your password</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #525252; margin: 0 0 24px;">
        We received a request to reset your password. Click the button below to choose a new one.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${url}" style="display: inline-block; padding: 12px 32px; background: #16a34a; color: white; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px;">
          Reset Password
        </a>
      </div>
      <p style="font-size: 12px; color: #a3a3a3; margin: 24px 0 0;">
        If you didn't request this, you can safely ignore this email. This link expires in 1 hour.
      </p>
    </div>
  `;
}
