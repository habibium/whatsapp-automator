pub(crate) mod templates;

use anyhow::Context;
use lettre::{
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
    message::{Mailbox, MultiPart},
};

pub struct Email {
    pub subject: &'static str,
    pub text: String,
    pub html: String,
}

#[derive(Clone)]
pub enum Mailer {
    Smtp {
        transport: AsyncSmtpTransport<Tokio1Executor>,
        from: Mailbox,
    },
    /// Development fallback: each email, link included, goes to the log
    Log,
    #[cfg(test)]
    Outbox(std::sync::Arc<std::sync::Mutex<Vec<(String, Email)>>>),
}

impl Mailer {
    /// # Errors
    /// `smtp_url` is not an SMTP connection URL.
    pub fn new(smtp_url: Option<&str>, from: Mailbox) -> anyhow::Result<Self> {
        let Some(url) = smtp_url else {
            tracing::warn!("SMTP_URL is not set, so emails are logged instead of sent");
            return Ok(Self::Log);
        };
        let transport = AsyncSmtpTransport::<Tokio1Executor>::from_url(url)
            .context("SMTP_URL must look like smtps://user:password@smtp.example.com:465")?
            .build();

        Ok(Self::Smtp { transport, from })
    }

    /// Logs whether the SMTP server answers, so a wrong `SMTP_URL` shows at startup rather than
    /// at the first signup
    pub async fn check(&self) {
        let Self::Smtp { transport, .. } = self else {
            return;
        };
        match transport.test_connection().await {
            Ok(true) => tracing::info!("SMTP server is reachable"),
            Ok(false) => tracing::error!("SMTP server did not answer"),
            Err(error) => tracing::error!(?error, "cannot reach the SMTP server"),
        }
    }

    /// The caller never waits on SMTP, so a response takes the same time whether or not an email
    /// went out, and a slow mail server cannot hold up a request
    pub fn send_in_background(&self, to: String, email: Email) {
        // Kept at once rather than in a task, so a test can read it as soon as the response is back
        #[cfg(test)]
        if let Self::Outbox(outbox) = self {
            outbox
                .lock()
                .unwrap_or_else(std::sync::PoisonError::into_inner)
                .push((to, email));
            return;
        }
        let mailer = self.clone();
        tokio::spawn(async move {
            if let Err(error) = mailer.send(&to, email).await {
                tracing::error!(?error, "failed to send email");
            }
        });
    }

    async fn send(&self, to: &str, email: Email) -> anyhow::Result<()> {
        match self {
            Self::Smtp { transport, from } => {
                let message = Message::builder()
                    .from(from.clone())
                    .to(to.parse()?)
                    .subject(email.subject)
                    .multipart(MultiPart::alternative_plain_html(email.text, email.html))?;
                transport.send(message).await?;
            }
            Self::Log => {
                tracing::info!(
                    to,
                    subject = email.subject,
                    "email not sent\n\n{}",
                    email.text
                );
            }
            #[cfg(test)]
            Self::Outbox(_) => unreachable!("send_in_background keeps these"),
        }

        Ok(())
    }
}
