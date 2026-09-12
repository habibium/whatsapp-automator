use std::{env, path::PathBuf};

use anyhow::Context;

pub struct Config {
    pub database_url: String,
    pub port: u16,
    pub web_dir: PathBuf,
}

impl Config {
    /// # Errors
    /// `DATABASE_URL` missing, or `PORT` set to something that is not a port number.
    pub fn from_env() -> anyhow::Result<Self> {
        let port = match env::var("PORT") {
            Ok(value) => value.parse().context("PORT must be a valid port number")?,
            Err(_) => 8000,
        };

        Ok(Self {
            database_url: env::var("DATABASE_URL").context("DATABASE_URL is required")?,
            port,
            web_dir: env::var_os("WEB_DIR")
                .map_or_else(|| PathBuf::from("web/dist"), PathBuf::from),
        })
    }
}
