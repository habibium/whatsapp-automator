use anyhow::Context;
use axum_extra::extract::cookie::CookieJar;
use chrono::TimeDelta;
use serde::{Serialize, de::DeserializeOwned};
use sqlx::{PgExecutor, PgPool};
use url::Url;
use uuid::Uuid;
use webauthn_rs::{Webauthn, WebauthnBuilder};

use super::{
    cookie,
    token::{self, Token},
};
use crate::{db, error::AppError};

/// How long a browser has to answer a challenge, which is also the timeout it is given
pub const TTL: TimeDelta = TimeDelta::minutes(5);

const RP_NAME: &str = "WhatsApp Automator";

/// `APP_URL` is the only origin accepted, and its host is the RP ID every passkey is bound to: moving
/// the app to another host strands the passkeys registered on the old one.
///
/// # Errors
/// `APP_URL`'s host is an IP address, which WebAuthn does not accept as an RP ID.
pub fn relying_party(app_url: &Url) -> anyhow::Result<Webauthn> {
    let rp_id = app_url
        .domain()
        .context("passkeys need APP_URL to use a domain name, not an IP address")?;
    let webauthn = WebauthnBuilder::new(rp_id, app_url)?
        .rp_name(RP_NAME)
        .timeout(TTL.to_std()?)
        .build()?;

    Ok(webauthn)
}

/// The kind of ceremony a row holds state for; matches the `passkey_ceremonies.kind` check
#[derive(Clone, Copy)]
pub enum Ceremony {
    Registration,
}

impl Ceremony {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Registration => "registration",
        }
    }
}

/// Saves a ceremony's state server-side and gives the browser only a cookie naming it. A ceremony
/// the browser already had under way is dropped.
pub async fn begin<T: Serialize + Sync>(
    db: &PgPool,
    jar: CookieJar,
    ceremony: Ceremony,
    user_id: Option<Uuid>,
    state: &T,
    secure: bool,
) -> Result<CookieJar, AppError> {
    if let Some(previous) = cookie::PASSKEY_CEREMONY.read(&jar, secure) {
        db::passkey_ceremonies::delete(db, &token::hash(previous)).await?;
    }
    let token = Token::generate()?;
    db::passkey_ceremonies::insert(db, &token.hash, ceremony, user_id, state, TTL).await?;

    Ok(cookie::PASSKEY_CEREMONY.set(jar, token.value, secure))
}

/// Spends the ceremony the browser's cookie names and returns its state, or `None` when there is
/// no live one of this kind for `user_id`. Run it outside any transaction that may roll back, so
/// a response that then fails verification still uses the ceremony up.
pub async fn finish<T: DeserializeOwned + Send + Unpin + 'static>(
    db: impl PgExecutor<'_>,
    jar: &CookieJar,
    ceremony: Ceremony,
    user_id: Option<Uuid>,
    secure: bool,
) -> Result<Option<T>, AppError> {
    let Some(token) = cookie::PASSKEY_CEREMONY.read(jar, secure) else {
        return Ok(None);
    };
    let state = db::passkey_ceremonies::consume(db, &token::hash(token), ceremony, user_id).await?;

    Ok(state)
}
