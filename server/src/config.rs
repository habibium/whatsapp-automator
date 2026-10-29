use std::{env, path::PathBuf};

use anyhow::Context;
use lettre::message::Mailbox;
use url::Url;

pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub web_dir: PathBuf,
    /// Origin the SPA is served from; links in emails point here, and https turns on secure cookies
    pub app_url: Url,
    /// `None` writes emails to the log instead of sending them
    pub smtp_url: Option<String>,
    pub email_from: Mailbox,
}

impl Config {
    /// # Errors
    /// `DATABASE_URL` missing, `APP_URL` missing from a release build, `PORT` or `APP_URL`
    /// malformed, an https `APP_URL` without `SMTP_URL`, or `SMTP_URL` without a valid
    /// `EMAIL_FROM`.
    pub fn from_env() -> anyhow::Result<Self> {
        let port = match env::var("PORT") {
            Ok(value) => value.parse().context("PORT must be a valid port number")?,
            Err(_) => 8000,
        };

        let app_url = match env::var("APP_URL") {
            Ok(url) => url,
            // The Vite dev server `just dev` runs. A release build has to be told, or its email
            // links would point at localhost and its cookies would lose `Secure`.
            Err(_) if cfg!(debug_assertions) => "http://localhost:5173".into(),
            Err(_) => anyhow::bail!("APP_URL is required, e.g. https://wa.example.com"),
        };
        let app_url = Url::parse(&app_url).context("APP_URL must be an absolute URL")?;
        anyhow::ensure!(
            matches!(app_url.scheme(), "http" | "https"),
            "APP_URL must start with http:// or https://"
        );

        let smtp_url = env::var("SMTP_URL").ok().filter(|url| !url.is_empty());
        // Without SMTP, live sign-in links land in the log, which is fine on a dev machine only
        anyhow::ensure!(
            smtp_url.is_some() || app_url.scheme() == "http",
            "SMTP_URL is required when APP_URL is https"
        );
        let email_from = match env::var("EMAIL_FROM") {
            Ok(from) => from
                .parse()
                .context("EMAIL_FROM must look like `Name <address@example.com>`")?,
            Err(_) if smtp_url.is_some() => anyhow::bail!("EMAIL_FROM is required with SMTP_URL"),
            Err(_) => "WhatsApp Automator <no-reply@localhost>".parse()?,
        };

        Ok(Self {
            database_url: env::var("DATABASE_URL").context("DATABASE_URL is required")?,
            port,
            web_dir: env::var_os("WEB_DIR")
                .map_or_else(|| PathBuf::from("web/dist"), PathBuf::from),
            app_url,
            smtp_url,
            email_from,
        })
    }
}
