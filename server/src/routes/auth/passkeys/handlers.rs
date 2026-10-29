use anyhow::Context;
use axum::{Json, extract::State};
use axum_extra::extract::cookie::CookieJar;
use webauthn_rs::prelude::{CredentialID, PasskeyRegistration};
use webauthn_rs_proto::ResidentKeyRequirement;

use super::dto::{ConfirmPasskeyChange, NewPasskey, PasskeyCreationOptions, PasskeyResponse};
use crate::{
    AppState,
    auth::{
        cookie,
        passkey::{self, Ceremony},
        reauth,
        session::Session,
    },
    db,
    email::templates::{self, SecurityEvent},
    error::{AppError, ErrorBody},
    extract::ValidatedJson,
};

const DEFAULT_NAME: &str = "Passkey";
/// More than anyone keeps for one account; the cap stops a single account from filling the table
const MAX_PASSKEYS: usize = 20;

/// Start adding a passkey
///
/// Checks the password again and returns the options for `navigator.credentials.create()`. The
/// challenge stays on the server for five minutes, named by a cookie.
#[utoipa::path(post, path = "/passkeys/registration/start", request_body = ConfirmPasskeyChange, responses(
    (status = OK, body = PasskeyCreationOptions, headers(("set-cookie" = String, description = "Names this registration"))),
    (status = BAD_REQUEST, description = "Wrong password", body = ErrorBody),
    (status = UNAUTHORIZED, body = ErrorBody),
    (status = CONFLICT, description = "The account has as many passkeys as it may hold", body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn start_registration(
    State(state): State<AppState>,
    jar: CookieJar,
    session: Session,
    ValidatedJson(payload): ValidatedJson<ConfirmPasskeyChange>,
) -> Result<(CookieJar, Json<PasskeyCreationOptions>), AppError> {
    let user = session.user;
    reauth::confirm_password(&state.pool, user.id, payload.password).await?;

    let existing = db::passkeys::credential_ids(&state.pool, user.id).await?;
    if existing.len() >= MAX_PASSKEYS {
        return Err(AppError::Conflict("Remove a passkey before adding another"));
    }
    let exclude = existing.into_iter().map(CredentialID::from).collect();
    let (mut options, registration) = passkey::relying_party(&state.app_url)?
        .start_passkey_registration(user.id, &user.email, &user.email, Some(exclude))
        .context("cannot start a passkey registration")?;
    // Sign-in names no account, so a credential the authenticator does not store could never be used
    if let Some(selection) = &mut options.public_key.authenticator_selection {
        selection.resident_key = Some(ResidentKeyRequirement::Required);
        selection.require_resident_key = true;
    }

    let jar = passkey::begin(
        &state.pool,
        jar,
        Ceremony::Registration,
        Some(user.id),
        &registration,
        state.secure_cookies(),
    )
    .await?;

    Ok((
        jar,
        Json(PasskeyCreationOptions {
            public_key: options.public_key,
        }),
    ))
}

/// Finish adding a passkey
///
/// Verifies the credential `navigator.credentials.create()` made against the challenge from the
/// start, saves it and emails the owner. A challenge works once.
#[utoipa::path(post, path = "/passkeys/registration/finish", request_body = NewPasskey, responses(
    (status = OK, body = PasskeyResponse),
    (status = BAD_REQUEST, description = "The credential failed verification, or the registration expired or already finished", body = ErrorBody),
    (status = UNAUTHORIZED, body = ErrorBody),
    (status = CONFLICT, description = "The passkey is already registered", body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn finish_registration(
    State(state): State<AppState>,
    jar: CookieJar,
    session: Session,
    ValidatedJson(payload): ValidatedJson<NewPasskey>,
) -> Result<(CookieJar, Json<PasskeyResponse>), AppError> {
    let secure = state.secure_cookies();
    let user = session.user;
    let registration: PasskeyRegistration = passkey::finish(
        &state.pool,
        &jar,
        Ceremony::Registration,
        Some(user.id),
        secure,
    )
    .await?
    .ok_or(AppError::PasskeyRejected)?;

    let credential = passkey::relying_party(&state.app_url)?
        .finish_passkey_registration(&payload.credential, &registration)
        .map_err(|error| {
            tracing::info!(?error, "passkey registration failed verification");
            AppError::PasskeyRejected
        })?;
    let name = payload
        .name
        .as_deref()
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .unwrap_or(DEFAULT_NAME);
    let saved = db::passkeys::insert(&state.pool, user.id, &credential, name)
        .await
        .map_err(|e| match e {
            sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
                AppError::Conflict("This passkey is already registered")
            }
            e => e.into(),
        })?;

    let alert = templates::security_alert(SecurityEvent::PasskeyAdded, &state.app_url)?;
    state.mailer.send_in_background(user.email, alert);

    Ok((
        cookie::PASSKEY_CEREMONY.clear(jar, secure),
        Json(saved.into()),
    ))
}
