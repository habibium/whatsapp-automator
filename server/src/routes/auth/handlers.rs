use anyhow::Context;
use axum::{
    Json,
    extract::State,
    http::{HeaderValue, StatusCode, header},
    response::IntoResponse,
};
use axum_extra::extract::cookie::CookieJar;
use sqlx::{PgConnection, PgExecutor};
use url::Url;
use uuid::Uuid;

use super::dto::{
    Credentials, EmailAddress, EmailToken, EmailVerified, PasswordReset, SessionResponse,
    SignInCredentials, SignInResponse, UserResponse,
};
use crate::{
    AppState,
    auth::{
        cookie, password,
        session::{self, Session},
        token::{self, Purpose, Token},
        two_factor,
    },
    db::{self, users::User},
    email::templates::{self, SecurityEvent},
    error::{AppError, ErrorBody},
    extract::ValidatedJson,
};

/// Sign up
///
/// Creates an account and emails a link to verify its address. Signing in waits until the
/// address is verified.
#[utoipa::path(post, path = "/signup", request_body = Credentials, responses(
    (status = OK, body = UserResponse, headers(("set-cookie" = String, description = "Marks this browser, so the verification link signs it in"))),
    (status = BAD_REQUEST, description = "Invalid email, or an invalid or breached password", body = ErrorBody),
    (status = CONFLICT, body = ErrorBody),
    (status = TOO_MANY_REQUESTS, description = "Too many writes from this client", body = ErrorBody, headers(("retry-after" = u64, description = "Seconds until another attempt is allowed"))),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn signup(
    State(state): State<AppState>,
    jar: CookieJar,
    ValidatedJson(payload): ValidatedJson<Credentials>,
) -> Result<(CookieJar, Json<UserResponse>), AppError> {
    state
        .pwned_passwords
        .reject_breached("password", &payload.password)
        .await?;
    let password_hash = password::hash(payload.password).await?;
    // Lets the verification link sign in this browser, and no other
    let binding = Token::generate()?;

    let mut tx = state.pool.begin().await?;
    let user = db::users::insert(
        &mut *tx,
        &normalize(&payload.email),
        &password_hash,
        &binding.hash,
    )
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
            AppError::Conflict("Email already registered")
        }
        e => e.into(),
    })?;
    let link = create_link(&mut *tx, &state.app_url, user.id, Purpose::VerifyEmail).await?;
    tx.commit().await?;

    state
        .mailer
        .send_in_background(user.email.clone(), templates::verify_email(&link));
    let jar = cookie::SIGNUP.set(jar, binding.value, state.secure_cookies());

    Ok((jar, Json(user.into())))
}

/// Sign in
///
/// Starts a session for a verified account and sets it as an `HttpOnly` cookie. With two-step
/// verification on, answers `two_factor_required` instead and sets a cookie that
/// `POST /signin/two-factor` needs within five minutes to finish the sign-in.
#[utoipa::path(post, path = "/signin", request_body = SignInCredentials, responses(
    (status = OK, body = SignInResponse, headers(("set-cookie" = String, description = "The session cookie, or the one that carries the sign-in to its second factor"))),
    (status = BAD_REQUEST, body = ErrorBody),
    (status = UNAUTHORIZED, description = "Unknown email or wrong password", body = ErrorBody),
    (status = FORBIDDEN, description = "The address is not verified yet", body = ErrorBody),
    (status = TOO_MANY_REQUESTS, description = "Too many attempts from this client or at this account", body = ErrorBody, headers(("retry-after" = u64, description = "Seconds until another attempt is allowed"))),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn signin(
    State(state): State<AppState>,
    jar: CookieJar,
    ValidatedJson(payload): ValidatedJson<SignInCredentials>,
) -> Result<(CookieJar, Json<SignInResponse>), AppError> {
    let email = normalize(&payload.email);
    // Ahead of the lookup and Argon2, so a refused guess costs next to nothing
    state.rate_limits.signin(&email)?;
    let account = db::users::find_with_password(&state.pool, &email).await?;
    let stored_hash = account.as_ref().map(|(_, hash)| hash.clone());
    if !password::verify(payload.password, stored_hash).await? {
        return Err(AppError::InvalidCredentials);
    }
    let (user, password_hash) = account.ok_or(AppError::InvalidCredentials)?;

    // Checked after the password, so only someone who knows it learns the account exists
    if user.verified_at.is_none() {
        return Err(AppError::EmailNotVerified);
    }

    let secure = state.secure_cookies();
    let mut tx = state.pool.begin().await?;
    // Waits for a change to two-step verification in flight, so turning it on cannot sign every
    // session out and then meet one that started without the second factor
    db::users::lock(&mut *tx, user.id).await?;
    let (started, response) = if db::two_factor::is_enabled(&mut *tx, user.id).await? {
        let started =
            two_factor::start_challenge(&mut *tx, jar, user.id, &password_hash, secure).await?;
        (started, SignInResponse::TwoFactorRequired)
    } else {
        let started =
            session::start_with_password(&mut *tx, jar, user.id, &password_hash, secure).await?;
        (started, SignInResponse::SignedIn { user: user.into() })
    };
    let jar = started.ok_or(AppError::InvalidCredentials)?;
    tx.commit().await?;

    Ok((jar, Json(response)))
}

/// Sign out
///
/// Ends the current session and clears its cookie. Answers 204 even when nobody was signed in.
#[utoipa::path(post, path = "/signout", responses(
    (status = NO_CONTENT),
    (status = TOO_MANY_REQUESTS, description = "Too many writes from this client", body = ErrorBody, headers(("retry-after" = u64, description = "Seconds until another attempt is allowed"))),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn signout(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<(CookieJar, StatusCode), AppError> {
    let secure = state.secure_cookies();
    if let Some(token) = cookie::SESSION.read(&jar, secure) {
        db::sessions::delete(&state.pool, &token::hash(token)).await?;
    }

    Ok((cookie::SESSION.clear(jar, secure), StatusCode::NO_CONTENT))
}

/// Current session
///
/// The signed-in user, or `null`. Reading it also keeps an active session from expiring.
#[utoipa::path(get, path = "/session", responses(
    (status = OK, body = SessionResponse),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn get_session(
    State(state): State<AppState>,
    jar: CookieJar,
    current: Option<Session>,
) -> Result<impl IntoResponse, AppError> {
    // Personal data, so no shared cache may keep it and hand it to someone else
    let no_store = [(header::CACHE_CONTROL, HeaderValue::from_static("no-store"))];
    let secure = state.secure_cookies();
    let Some(current) = current else {
        // Otherwise a cookie whose session expired or was revoked would be sent forever
        let jar = cookie::SESSION.clear(jar, secure);
        return Ok((no_store, jar, Json(SessionResponse { user: None })));
    };

    let jar = current.refresh(&state.pool, jar, secure).await?;
    let user = Some(current.user.into());

    Ok((no_store, jar, Json(SessionResponse { user })))
}

/// Verify email
///
/// Spends the token from a verification email and marks the address verified. The browser that
/// signed up is signed in as well; any other browser has to sign in afterwards.
#[utoipa::path(post, path = "/verify-email", request_body = EmailToken, responses(
    (status = OK, body = EmailVerified, headers(("set-cookie" = String, description = "The session cookie, for the browser that signed up"))),
    (status = BAD_REQUEST, description = "The link is malformed, expired or already used", body = ErrorBody),
    (status = TOO_MANY_REQUESTS, description = "Too many writes from this client", body = ErrorBody, headers(("retry-after" = u64, description = "Seconds until another attempt is allowed"))),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn verify_email(
    State(state): State<AppState>,
    jar: CookieJar,
    ValidatedJson(payload): ValidatedJson<EmailToken>,
) -> Result<(CookieJar, Json<EmailVerified>), AppError> {
    let secure = state.secure_cookies();
    let mut tx = state.pool.begin().await?;
    let user_id = consume_token(&mut tx, &payload.token, Purpose::VerifyEmail).await?;

    // Anyone can open a link they hold in someone else's browser; signing that browser in would
    // put its owner in the wrong account. Only the browser that signed up gets a session.
    let binding = db::users::signup_binding(&mut *tx, user_id).await?;
    let signed_in = matches!(
        (binding, cookie::SIGNUP.read(&jar, secure).map(token::hash)),
        (Some(expected), Some(actual)) if expected == actual
    );
    let user = db::users::mark_verified(&mut *tx, user_id).await?;
    let jar = cookie::SIGNUP.clear(jar, secure);
    let jar = if signed_in {
        session::start(&mut *tx, jar, user.id, secure).await?
    } else {
        jar
    };
    tx.commit().await?;

    let user = user.into();
    Ok((jar, Json(EmailVerified { user, signed_in })))
}

/// Resend verification email
///
/// Emails a new verification link when the address belongs to an unverified account. Always
/// answers 202, so the response does not reveal whether an account exists.
#[utoipa::path(post, path = "/resend-verification", request_body = EmailAddress, responses(
    (status = ACCEPTED),
    (status = BAD_REQUEST, body = ErrorBody),
    (status = TOO_MANY_REQUESTS, description = "Too many writes from this client", body = ErrorBody, headers(("retry-after" = u64, description = "Seconds until another attempt is allowed"))),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn resend_verification(
    State(state): State<AppState>,
    ValidatedJson(payload): ValidatedJson<EmailAddress>,
) -> Result<StatusCode, AppError> {
    let user = db::users::find_by_email(&state.pool, &normalize(&payload.email)).await?;
    if let Some(user) = user.filter(|user| user.verified_at.is_none()) {
        email_link(&state, user, Purpose::VerifyEmail).await?;
    }

    Ok(StatusCode::ACCEPTED)
}

/// Request a password reset
///
/// Emails a link to choose a new password when the address belongs to an account. Always
/// answers 202, so the response does not reveal whether an account exists.
#[utoipa::path(post, path = "/forgot-password", request_body = EmailAddress, responses(
    (status = ACCEPTED),
    (status = BAD_REQUEST, body = ErrorBody),
    (status = TOO_MANY_REQUESTS, description = "Too many writes from this client", body = ErrorBody, headers(("retry-after" = u64, description = "Seconds until another attempt is allowed"))),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn forgot_password(
    State(state): State<AppState>,
    ValidatedJson(payload): ValidatedJson<EmailAddress>,
) -> Result<StatusCode, AppError> {
    if let Some(user) = db::users::find_by_email(&state.pool, &normalize(&payload.email)).await? {
        email_link(&state, user, Purpose::ResetPassword).await?;
    }

    Ok(StatusCode::ACCEPTED)
}

/// Reset password
///
/// Spends the token from a reset email and sets the new password. Every session, sign-in waiting
/// for a second factor and other emailed link of the account stops working, so the user signs in
/// again everywhere.
#[utoipa::path(post, path = "/reset-password", request_body = PasswordReset, responses(
    (status = OK, body = UserResponse),
    (status = BAD_REQUEST, description = "Invalid or breached password, or the link is malformed, expired or already used", body = ErrorBody),
    (status = TOO_MANY_REQUESTS, description = "Too many writes from this client", body = ErrorBody, headers(("retry-after" = u64, description = "Seconds until another attempt is allowed"))),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn reset_password(
    State(state): State<AppState>,
    ValidatedJson(payload): ValidatedJson<PasswordReset>,
) -> Result<Json<UserResponse>, AppError> {
    // Ahead of the transaction, so no connection or token lock waits on HIBP
    state
        .pwned_passwords
        .reject_breached("password", &payload.password)
        .await?;
    let mut tx = state.pool.begin().await?;
    let user_id = consume_token(&mut tx, &payload.token, Purpose::ResetPassword).await?;
    // Hashing is the expensive step, so it waits until the token checks out
    let password_hash = password::hash(payload.password).await?;
    // The password changes before sessions go, so a sign-in racing this reset cannot slip a
    // session in between (see `db::sessions::insert_if_password`)
    let user = db::users::set_password(&mut *tx, user_id, &password_hash).await?;
    db::sessions::delete_for_user(&mut *tx, user.id).await?;
    db::tokens::delete_all_for_user(&mut *tx, user.id).await?;
    db::two_factor::delete_challenges_for_user(&mut *tx, user.id).await?;
    tx.commit().await?;

    let alert = templates::security_alert(SecurityEvent::PasswordChanged, &state.app_url)?;
    state.mailer.send_in_background(user.email.clone(), alert);

    Ok(Json(user.into()))
}

/// Emails a fresh link unless one went out in the last minute. The callers accept any address,
/// so without that pause they could be used to flood someone's inbox.
async fn email_link(state: &AppState, user: User, purpose: Purpose) -> Result<(), AppError> {
    let mut tx = state.pool.begin().await?;
    // Concurrent requests for this user take turns, so only the first finds no recent link
    db::users::lock(&mut *tx, user.id).await?;
    if db::tokens::issued_recently(&mut *tx, user.id, purpose).await? {
        return Ok(());
    }
    let link = create_link(&mut *tx, &state.app_url, user.id, purpose).await?;
    tx.commit().await?;

    let email = match purpose {
        Purpose::VerifyEmail => templates::verify_email(&link),
        Purpose::ResetPassword => templates::reset_password(&link),
    };
    state.mailer.send_in_background(user.email, email);

    Ok(())
}

/// Saves a new single-use token and returns the SPA link that carries it
async fn create_link(
    db: impl PgExecutor<'_>,
    app_url: &Url,
    user_id: Uuid,
    purpose: Purpose,
) -> Result<Url, AppError> {
    let token = Token::generate()?;
    db::tokens::insert(db, &token.hash, user_id, purpose).await?;

    let path = match purpose {
        Purpose::VerifyEmail => "/verify-email",
        Purpose::ResetPassword => "/reset-password",
    };
    let mut link = app_url
        .join(path)
        .context("APP_URL cannot be a base for links")?;
    link.query_pairs_mut().append_pair("token", &token.value);

    Ok(link)
}

/// Spends `token` and retires every other link the user holds for the same purpose
async fn consume_token(
    conn: &mut PgConnection,
    token: &str,
    purpose: Purpose,
) -> Result<Uuid, AppError> {
    let user_id = db::tokens::consume(&mut *conn, &token::hash(token), purpose)
        .await?
        .ok_or(AppError::InvalidToken)?;
    db::tokens::delete_for_user(&mut *conn, user_id, purpose).await?;

    Ok(user_id)
}

/// Addresses are stored lowercased, so every lookup has to match
fn normalize(email: &str) -> String {
    email.to_lowercase()
}
