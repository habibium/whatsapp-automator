/** Inline-styled HTML email templates. */

type LayoutOptions = {
  heading: string;
  intro: string;
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
};

function layout({ heading, intro, ctaLabel, ctaUrl, footer }: LayoutOptions): string {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px;color:#18181b;">
      <div style="text-align:center;margin-bottom:32px;">
        <div style="display:inline-block;width:48px;height:48px;line-height:48px;background:#16a34a;border-radius:12px;font-size:24px;">📅</div>
        <h1 style="margin:12px 0 0;font-size:20px;">WA Scheduler</h1>
      </div>
      <div style="background:#ffffff;border-radius:12px;padding:32px;">
        <h2 style="margin:0 0 12px;font-size:18px;">${heading}</h2>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#52525b;">${intro}</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${ctaUrl}" style="display:inline-block;padding:12px 32px;background:#16a34a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">${ctaLabel}</a>
        </div>
        <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#a1a1aa;">${footer}</p>
      </div>
    </div>
  </body>
</html>`;
}

export function verificationEmail(url: string): string {
  return layout({
    heading: "Verify your email address",
    intro: "Thanks for signing up. Confirm your email address to activate your account.",
    ctaLabel: "Verify email",
    ctaUrl: url,
    footer: "If you didn't create an account, you can safely ignore this email."
  });
}

export function passwordResetEmail(url: string): string {
  return layout({
    heading: "Reset your password",
    intro: "We received a request to reset your password. Choose a new one below.",
    ctaLabel: "Reset password",
    ctaUrl: url,
    footer: "If you didn't request this, you can safely ignore this email."
  });
}
