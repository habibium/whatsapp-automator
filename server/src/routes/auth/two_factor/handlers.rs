use anyhow::Context;
use axum::{
    Json,
    extract::State,
    http::{HeaderValue, header},
    response::IntoResponse,
};
use axum_extra::extract::cookie::CookieJar;
use sqlx::PgConnection;
use uuid::Uuid;

use super::dto::{
    AuthenticatorCode, PasswordConfirmation, RecoveryCodes, TwoFactorSetup, TwoFactorStatus,
};
use crate::{
    AppState,
    auth::{
        reauth,
        session::{self, Session},
        two_factor,
    },
    db,
    email::templates::{self, SecurityEvent},
    error::{AppError, ErrorBody},
    extract::ValidatedJson,
};

/// Responses here carry keys, codes or account state that no cache may keep
const NO_STORE: [(header::HeaderName, HeaderValue); 1] =
    [(header::CACHE_CONTROL, HeaderValue::from_static("no-store"))];

/// Two-step verification status
///
/// Whether signing in asks for a code from an authenticator app, and how many recovery codes are
/// left.
#[utoipa::path(get, path = "/two-factor", responses(
    (status = OK, body = TwoFactorStatus),
    (status = UNAUTHORIZED, body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn get_two_factor(
    State(state): State<AppState>,
    session: Session,
) -> Result<impl IntoResponse, AppError> {
    let status = db::two_factor::status(&state.pool, session.user.id).await?;

    Ok((NO_STORE, Json(TwoFactorStatus::from(status))))
}

/// Start setting up two-step verification
///
/// Checks the password, then creates a key for an authenticator app. Signing in does not ask for
/// codes until `POST /two-factor/enable` confirms the app shows the right one. Starting again
/// replaces a key that was never confirmed.
#[utoipa::path(post, path = "/two-factor/setup", request_body = PasswordConfirmation, responses(
    (status = OK, body = TwoFactorSetup),
    (status = BAD_REQUEST, description = "The password is incorrect", body = ErrorBody),
    (status = UNAUTHORIZED, body = ErrorBody),
    (status = CONFLICT, description = "Two-step verification is already on", body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn setup_two_factor(
    State(state): State<AppState>,
    session: Session,
    ValidatedJson(payload): ValidatedJson<PasswordConfirmation>,
) -> Result<impl IntoResponse, AppError> {
    let user = session.user;
    reauth::confirm_password(&state.pool, user.id, payload.password).await?;

    let secret = two_factor::new_secret()?;
    let totp = two_factor::totp(secret.as_slice(), &user.email)?;
    let sealed = two_factor::seal(&state.cipher, user.id, secret.as_slice())?;
    if !db::two_factor::save_pending(&state.pool, user.id, &sealed).await? {
        return Err(AppError::Conflict("Two-step verification is already on"));
    }

    let otpauth_url = totp
        .to_url()
        .context("the email cannot label an authenticator entry")?;
    let setup = TwoFactorSetup {
        qr_code: two_factor::qr_code(&otpauth_url)?,
        secret: totp.secret().to_base32(),
        otpauth_url,
    };

    Ok((NO_STORE, Json(setup)))
}

/// Turn on two-step verification
///
/// Confirms the pending key with a code from the authenticator app, after which signing in asks
/// for a code too. Returns ten recovery codes, each good for one sign-in without the app. Every
/// session of the account ends, this one included, and this browser gets a new one, so a session
/// someone else may already hold does not outlast the change.
#[utoipa::path(post, path = "/two-factor/enable", request_body = AuthenticatorCode, responses(
    (status = OK, body = RecoveryCodes, headers(("set-cookie" = String, description = "A new session cookie"))),
    (status = BAD_REQUEST, description = "The code is wrong", body = ErrorBody),
    (status = UNAUTHORIZED, body = ErrorBody),
    (status = CONFLICT, description = "Already on, or the setup was never started", body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn enable_two_factor(
    State(state): State<AppState>,
    jar: CookieJar,
    session: Session,
    ValidatedJson(payload): ValidatedJson<AuthenticatorCode>,
) -> Result<impl IntoResponse, AppError> {
    let user = session.user;
    let mut tx = state.pool.begin().await?;
    // Changes to this account and its sign-ins take turns, so none slips in between the sign-out
    // below and the commit
    db::users::lock(&mut *tx, user.id).await?;
    let pending = match db::two_factor::find_secret(&mut *tx, user.id).await? {
        Some(secret) if secret.enabled => {
            return Err(AppError::Conflict("Two-step verification is already on"));
        }
        Some(secret) => secret,
        None => return Err(AppError::Conflict("Start the setup first")),
    };
    let key = two_factor::open(&state.cipher, user.id, &pending.sealed)?;
    let totp = two_factor::totp(&key, &user.email)?;
    let step = two_factor::verify_code(&totp, &payload.code, None)
        .ok_or(AppError::IncorrectCode("code"))?;

    db::two_factor::enable(&mut *tx, user.id, step).await?;
    let recovery_codes = replace_recovery_codes(&mut tx, user.id).await?;
    db::sessions::delete_for_user(&mut *tx, user.id).await?;
    let jar = session::start(&mut *tx, jar, user.id, state.secure_cookies()).await?;
    tx.commit().await?;

    alert(&state, user.email, SecurityEvent::TwoFactorEnabled)?;

    Ok((NO_STORE, jar, Json(RecoveryCodes { recovery_codes })))
}

async fn replace_recovery_codes(
    conn: &mut PgConnection,
    user_id: Uuid,
) -> Result<Vec<String>, AppError> {
    let codes = two_factor::new_recovery_codes()?;
    let hashes: Vec<_> = codes
        .iter()
        .map(|code| two_factor::hash_recovery_code(user_id, code))
        .collect();
    db::two_factor::replace_recovery_codes(conn, user_id, &hashes).await?;

    Ok(codes)
}

fn alert(state: &AppState, email: String, event: SecurityEvent) -> Result<(), AppError> {
    let alert = templates::security_alert(event, &state.app_url)?;
    state.mailer.send_in_background(email, alert);

    Ok(())
}
