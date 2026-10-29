use anyhow::Context;
use axum::{
    Json,
    extract::State,
    http::{HeaderValue, header},
    response::IntoResponse,
};

use super::dto::{PasswordConfirmation, TwoFactorSetup, TwoFactorStatus};
use crate::{
    AppState,
    auth::{reauth, session::Session, two_factor},
    db,
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
