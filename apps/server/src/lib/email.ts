import { logger } from "@pkg/shared";
import { createTransport, type Transporter } from "nodemailer";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env["SMTP_HOST"];
  const port = Number(process.env["SMTP_PORT"] ?? "587");
  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];

  if (!host || !user || !pass) {
    logger.warn(
      "SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). Emails will be logged to console."
    );
    // Return a JSON transport that logs to stdout (dev fallback)
    transporter = createTransport({ jsonTransport: true });
    return transporter;
  }

  transporter = createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return transporter;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const transport = getTransporter();
  const from = process.env["SMTP_FROM"] ?? process.env["SMTP_USER"] ?? "noreply@wascheduler.app";

  try {
    const info = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html
    });

    // If using JSON transport (dev mode), log the email content
    if (info.message) {
      try {
        const parsed = JSON.parse(info.message);
        logger.info(
          {
            to: parsed.to?.[0]?.address ?? options.to,
            subject: parsed.subject
          },
          "📧 Email (dev mode — logged, not sent)"
        );
        // Extract the verification/reset URL from HTML for easy dev access
        const urlMatch = options.html.match(/href="([^"]+)"/);
        if (urlMatch?.[1]) {
          logger.info({ url: urlMatch[1] }, "🔗 Action URL");
        }
      } catch {
        logger.info({ to: options.to, subject: options.subject }, "Email sent (dev mode)");
      }
    } else {
      logger.info({ to: options.to, subject: options.subject }, "Email sent successfully");
    }
  } catch (error) {
    logger.error({ error, to: options.to }, "Failed to send email");
    throw error;
  }
}
