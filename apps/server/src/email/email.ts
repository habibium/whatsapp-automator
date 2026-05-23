import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../env";
import { logger } from "../logger";

let cachedTransporter: Transporter | null = null;

/** Lazily builds the SMTP transporter, or returns null when SMTP is unconfigured. */
function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  cachedTransporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } } : {})
  });
  return cachedTransporter;
}

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Sends a transactional email. When SMTP is not configured (typical in local
 * development) the email is logged instead so verification links remain usable.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    logger.warn(
      { to: message.to, subject: message.subject },
      "SMTP not configured — email logged instead of sent"
    );
    logger.debug({ html: message.html }, "Email content");
    return;
  }

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html
  });
  logger.info({ to: message.to, subject: message.subject }, "Email sent");
}
