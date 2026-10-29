use anyhow::Context;
use chrono::TimeDelta;
use url::Url;

use super::Email;
use crate::auth::token::Purpose;

const PRODUCT_NAME: &str = "WhatsApp Automator";

// Email clients ignore stylesheets and custom properties, so the neutral theme's light values
// are inlined: text primary and secondary, accent, and the border on white.
const FONT: &str =
    "Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const TEXT: &str = "#000000";
const MUTED: &str = "#474747";
const ACCENT: &str = "#1b1b1b";
const ON_ACCENT: &str = "#ffffff";
const HAIRLINE: &str = "#ebebeb";

pub fn verify_email(link: &Url) -> Email {
    let expires = in_words(Purpose::VerifyEmail.ttl());
    render(&Layout {
        subject: "Verify your email address",
        heading: "Verify your email address.",
        body: format!(
            "Confirm this address to finish setting up your {PRODUCT_NAME} account. The link expires in {expires}."
        ),
        action: "Verify email address",
        link,
        footer: "If you didn't create an account, you can ignore this email.",
    })
}

pub fn reset_password(link: &Url) -> Email {
    let expires = in_words(Purpose::ResetPassword.ttl());
    render(&Layout {
        subject: "Reset your password",
        heading: "Reset your password.",
        body: format!(
            "Someone asked to reset the password for your {PRODUCT_NAME} account. The link works once and expires in {expires}."
        ),
        action: "Choose a new password",
        link,
        footer: "If it wasn't you, ignore this email and your password stays the same.",
    })
}

/// An account change or sign-in the owner should hear about; the email offers the remedy for one
/// they did not make
#[derive(Clone, Copy)]
pub enum SecurityEvent {
    PasswordChanged,
    TwoFactorEnabled,
    TwoFactorDisabled,
    RecoveryCodesRegenerated,
    PasskeyAdded,
    PasskeyRemoved,
    /// A sign-in got the password right, then ran out of second-factor codes
    TooManyWrongCodes,
    /// A sign-in finished with a recovery code, which leaves `remaining` unused
    RecoveryCodeUsed {
        remaining: i64,
    },
}

const RESET_NOW: &str =
    "If this wasn't you, reset your password now, which signs out every device.";
const RESET_THEN_NEW_CODES: &str = "If this wasn't you, reset your password now, which signs out every device, then create new recovery codes.";

/// # Errors
/// `app_url` cannot be a base for links.
pub fn security_alert(event: SecurityEvent, app_url: &Url) -> anyhow::Result<Email> {
    let (subject, heading, what, remedy) = match event {
        SecurityEvent::PasswordChanged => (
            "Your password was changed",
            "Your password was changed.",
            format!(
                "The password for your {PRODUCT_NAME} account was changed, and every device was signed out."
            ),
            RESET_NOW,
        ),
        SecurityEvent::TwoFactorEnabled => (
            "Two-step verification is on",
            "Two-step verification is on.",
            format!(
                "Signing in to your {PRODUCT_NAME} account now also asks for a code from an authenticator app."
            ),
            "If this wasn't you, reset your password now, which signs out every device. If two-step verification then keeps you out, ask whoever runs this service to turn it off for you.",
        ),
        SecurityEvent::TwoFactorDisabled => (
            "Two-step verification is off",
            "Two-step verification is off.",
            format!(
                "Signing in to your {PRODUCT_NAME} account no longer asks for a code from an authenticator app."
            ),
            RESET_NOW,
        ),
        SecurityEvent::RecoveryCodesRegenerated => (
            "New recovery codes were created",
            "New recovery codes were created.",
            format!(
                "Your {PRODUCT_NAME} account has a new set of recovery codes, and the old ones stopped working."
            ),
            RESET_THEN_NEW_CODES,
        ),
        SecurityEvent::PasskeyAdded => (
            "A passkey was added to your account",
            "A passkey was added.",
            format!("A new passkey can now sign in to your {PRODUCT_NAME} account."),
            "If this wasn't you, remove it in your security settings first, since it keeps working after a password reset, then reset your password.",
        ),
        SecurityEvent::PasskeyRemoved => (
            "A passkey was removed from your account",
            "A passkey was removed.",
            format!("A passkey can no longer sign in to your {PRODUCT_NAME} account."),
            RESET_NOW,
        ),
        SecurityEvent::TooManyWrongCodes => (
            "Someone entered your password",
            "Someone entered your password.",
            format!(
                "Someone signed in to your {PRODUCT_NAME} account with the right password, then got the two-step verification code wrong too many times, so the sign-in was stopped."
            ),
            "If this wasn't you, someone else knows your password: reset it now, which signs out every device.",
        ),
        SecurityEvent::RecoveryCodeUsed { remaining } => (
            "A recovery code was used to sign in",
            "A recovery code was used.",
            format!(
                "Someone signed in to your {PRODUCT_NAME} account with a recovery code instead of a code from the authenticator app. {}",
                recovery_codes_left(remaining)
            ),
            RESET_THEN_NEW_CODES,
        ),
    };
    let (action, path) = if matches!(event, SecurityEvent::PasskeyAdded) {
        ("Review your passkeys", "/settings")
    } else {
        ("Reset your password", "/forgot-password")
    };
    let link = app_url
        .join(path)
        .context("APP_URL cannot be a base for links")?;

    Ok(render(&Layout {
        subject,
        heading,
        body: format!("{what} {remedy}"),
        action,
        link: &link,
        footer: "If it was you, there's nothing else to do.",
    }))
}

struct Layout<'a> {
    subject: &'static str,
    heading: &'static str,
    body: String,
    action: &'static str,
    link: &'a Url,
    footer: &'static str,
}

fn render(layout: &Layout) -> Email {
    let Layout {
        subject,
        heading,
        body,
        action,
        link,
        footer,
    } = layout;
    let link = escape(link.as_str());

    let text = format!(
        "{heading}\n\n{body}\n\n{action}: {}\n\n{footer}\n",
        layout.link
    );

    // Tables and inline styles are what every client, Outlook included, lays out the same way
    let html = format!(
        r#"<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>{subject}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;">{body}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center" style="padding:48px 24px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;font-family:{FONT};color:{TEXT};">
<tr><td style="padding-bottom:40px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="width:12px;"><div style="width:12px;height:12px;background:{ACCENT};border-radius:6px 6px 6px 0;font-size:0;line-height:0;">&nbsp;</div></td>
<td style="padding-left:8px;font-size:15px;line-height:20px;font-weight:600;letter-spacing:-0.012em;">{PRODUCT_NAME}</td>
</tr></table>
</td></tr>
<tr><td style="padding-bottom:12px;font-size:24px;line-height:30px;font-weight:600;letter-spacing:-0.02em;">{heading}</td></tr>
<tr><td style="padding-bottom:28px;font-size:15px;line-height:24px;color:{MUTED};">{body}</td></tr>
<tr><td style="padding-bottom:28px;">
<a href="{link}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:{ACCENT};color:{ON_ACCENT};font-size:15px;line-height:20px;font-weight:600;text-decoration:none;">{action}</a>
</td></tr>
<tr><td style="padding-bottom:32px;font-size:13px;line-height:20px;color:{MUTED};">Or paste this link into your browser:<br><a href="{link}" style="color:{TEXT};word-break:break-all;">{link}</a></td></tr>
<tr><td style="padding-top:20px;border-top:1px solid {HAIRLINE};font-size:13px;line-height:20px;color:{MUTED};">{footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
"#
    );

    Email {
        subject,
        text,
        html,
    }
}

fn recovery_codes_left(remaining: i64) -> String {
    match remaining {
        0 => "No recovery codes are left.".into(),
        1 => "1 recovery code is left.".into(),
        remaining => format!("{remaining} recovery codes are left."),
    }
}

fn in_words(duration: TimeDelta) -> String {
    match duration.num_hours() {
        1 => "an hour".into(),
        hours => format!("{hours} hours"),
    }
}

/// `APP_URL` is operator input, so the link is escaped before it lands in markup
fn escape(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for c in text.chars() {
        match c {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            c => escaped.push(c),
        }
    }
    escaped
}

#[cfg(test)]
mod tests {
    use url::Url;

    use super::{RESET_NOW, SecurityEvent, escape, reset_password, security_alert, verify_email};

    const EVERY_EVENT: [SecurityEvent; 8] = [
        SecurityEvent::PasswordChanged,
        SecurityEvent::TwoFactorEnabled,
        SecurityEvent::TwoFactorDisabled,
        SecurityEvent::RecoveryCodesRegenerated,
        SecurityEvent::PasskeyAdded,
        SecurityEvent::PasskeyRemoved,
        SecurityEvent::TooManyWrongCodes,
        SecurityEvent::RecoveryCodeUsed { remaining: 9 },
    ];

    fn alert_text(event: SecurityEvent) -> String {
        let app_url = Url::parse("https://example.com/").unwrap();
        security_alert(event, &app_url).unwrap().text
    }

    #[test]
    fn escapes_markup() {
        assert_eq!(escape(r#"a&b<c>"d'"#), "a&amp;b&lt;c&gt;&quot;d&#39;");
    }

    #[test]
    fn link_is_in_both_parts_and_escaped_in_html() {
        let link = Url::parse("https://example.com/verify-email?token=abc&x=1").unwrap();
        let email = verify_email(&link);

        assert!(
            email
                .text
                .contains("https://example.com/verify-email?token=abc&x=1")
        );
        assert!(
            email
                .html
                .contains(r#"href="https://example.com/verify-email?token=abc&amp;x=1""#)
        );
    }

    #[test]
    fn copy_quotes_how_long_each_link_lasts() {
        let link = Url::parse("https://example.com/").unwrap();

        assert!(verify_email(&link).text.contains("expires in 24 hours"));
        assert!(reset_password(&link).text.contains("expires in an hour"));
    }

    #[test]
    fn security_alert_links_to_a_password_reset() {
        let app_url = Url::parse("https://example.com/").unwrap();
        let email = security_alert(SecurityEvent::TwoFactorDisabled, &app_url).unwrap();

        assert!(email.text.contains("https://example.com/forgot-password"));
    }

    #[test]
    fn every_security_alert_renders_both_parts_with_a_remedy() {
        let app_url = Url::parse("https://example.com/").unwrap();

        for event in EVERY_EVENT {
            let email = security_alert(event, &app_url).unwrap();
            let paragraphs: Vec<&str> = email.text.trim_end().split("\n\n").collect();
            let [heading, body, action, footer] = paragraphs[..] else {
                panic!("unexpected layout: {}", email.text);
            };
            let (_, link) = action.split_once(": ").unwrap();

            assert!(body.contains("If this wasn't you"));
            assert!(
                email
                    .html
                    .contains(&format!("<title>{}</title>", email.subject))
            );
            for part in [heading, body, footer] {
                assert!(email.html.contains(part));
            }
            assert!(email.html.contains(&format!(r#"href="{link}""#)));
        }
    }

    #[test]
    fn each_security_alert_offers_a_remedy_that_works_for_it() {
        let passkey = alert_text(SecurityEvent::PasskeyAdded);
        assert!(passkey.contains("remove it in your security settings first"));
        assert!(passkey.contains("Review your passkeys: https://example.com/settings"));

        assert!(
            alert_text(SecurityEvent::TwoFactorEnabled)
                .contains("ask whoever runs this service to turn it off for you")
        );
        assert!(
            alert_text(SecurityEvent::TooManyWrongCodes)
                .contains("someone else knows your password: reset it now")
        );
        for event in [
            SecurityEvent::RecoveryCodesRegenerated,
            SecurityEvent::RecoveryCodeUsed { remaining: 9 },
        ] {
            assert!(alert_text(event).contains("then create new recovery codes"));
        }
        for event in [
            SecurityEvent::PasswordChanged,
            SecurityEvent::TwoFactorDisabled,
            SecurityEvent::PasskeyRemoved,
        ] {
            let text = alert_text(event);
            assert!(text.contains(RESET_NOW));
            assert!(text.contains("Reset your password: https://example.com/forgot-password"));
        }
    }

    #[test]
    fn recovery_code_alert_says_how_many_are_left() {
        for (remaining, left) in [
            (0, "No recovery codes are left."),
            (1, "1 recovery code is left."),
            (9, "9 recovery codes are left."),
        ] {
            assert!(alert_text(SecurityEvent::RecoveryCodeUsed { remaining }).contains(left));
        }
    }
}
