use axum::{
    extract::{FromRequestParts, OptionalFromRequestParts},
    http::request::Parts,
};
use axum_extra::extract::cookie::CookieJar;
use chrono::{DateTime, TimeDelta, Utc};
use sqlx::PgExecutor;
use uuid::Uuid;

use super::{
    cookie,
    token::{self, Token},
};
use crate::{db, db::users::User, error::AppError, state::AppState};

pub const TTL: TimeDelta = TimeDelta::days(30);
/// Expiry slides forward at most once a day, so reading the session is not a write every time
const REFRESH_AFTER: TimeDelta = TimeDelta::days(1);

/// The signed-in user, read from the session cookie. Rejects with 401 when there is no live
/// session; extract `Option<Session>` where signing in is optional.
pub struct Session {
    pub user: User,
    token: String,
    expires_at: DateTime<Utc>,
}

impl Session {
    /// Pushes the expiry a full TTL out again once it is a day old, and re-issues the cookie to
    /// match. Returns the jar unchanged otherwise.
    pub async fn refresh(
        &self,
        db: impl PgExecutor<'_>,
        jar: CookieJar,
        secure: bool,
    ) -> Result<CookieJar, AppError> {
        if self.expires_at > Utc::now() + TTL - REFRESH_AFTER {
            return Ok(jar);
        }
        db::sessions::extend(db, &token::hash(&self.token), TTL).await?;

        Ok(cookie::SESSION.set(jar, self.token.clone(), secure))
    }
}

impl OptionalFromRequestParts<AppState> for Session {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Option<Self>, Self::Rejection> {
        let jar = CookieJar::from_headers(&parts.headers);
        let Some(token) = cookie::SESSION.read(&jar, state.secure_cookies()) else {
            return Ok(None);
        };

        let session = db::sessions::find(&state.pool, &token::hash(token))
            .await?
            .map(|(user, expires_at)| Self {
                user,
                token: token.to_owned(),
                expires_at,
            });

        Ok(session)
    }
}

impl FromRequestParts<AppState> for Session {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        <Self as OptionalFromRequestParts<AppState>>::from_request_parts(parts, state)
            .await?
            .ok_or(AppError::Unauthorized)
    }
}

/// Creates a session for `user_id` and adds its cookie to `jar`
pub async fn start(
    db: impl PgExecutor<'_>,
    jar: CookieJar,
    user_id: Uuid,
    secure: bool,
) -> Result<CookieJar, AppError> {
    let token = Token::generate()?;
    db::sessions::insert(db, &token.hash, user_id, TTL).await?;

    Ok(cookie::SESSION.set(jar, token.value, secure))
}

/// Like [`start`], but only while the account's password is still `password_hash`. Returns
/// `None` when a reset replaced it during the sign-in, which must not outlive that reset.
pub async fn start_with_password(
    db: impl PgExecutor<'_>,
    jar: CookieJar,
    user_id: Uuid,
    password_hash: &str,
    secure: bool,
) -> Result<Option<CookieJar>, AppError> {
    let token = Token::generate()?;
    let started =
        db::sessions::insert_if_password(db, &token.hash, user_id, password_hash, TTL).await?;

    Ok(started.then(|| cookie::SESSION.set(jar, token.value, secure)))
}
