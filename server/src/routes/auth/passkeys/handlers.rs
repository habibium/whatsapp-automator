use anyhow::Context;
use axum::{
    Json,
    extract::{Path, State, rejection::PathRejection},
    http::{HeaderValue, StatusCode, header},
    response::IntoResponse,
};
use axum_extra::extract::cookie::CookieJar;
use uuid::Uuid;
use webauthn_rs::prelude::{
    CredentialID, DiscoverableAuthentication, DiscoverableKey, PasskeyRegistration,
};
use webauthn_rs_proto::ResidentKeyRequirement;

use super::dto::{
    ConfirmPasskeyChange, NewPasskey, PasskeyCreationOptions, PasskeyRequestOptions,
    PasskeyResponse, PasskeySignIn,
};
use crate::{
    AppState,
    auth::{
        cookie,
        passkey::{self, Ceremony},
        reauth,
        session::{self, Session},
    },
    db,
    email::templates::{self, SecurityEvent},
    error::{AppError, ErrorBody},
    extract::ValidatedJson,
    routes::auth::dto::UserResponse,
};

const DEFAULT_NAME: &str = "Passkey";
/// More than anyone keeps for one account; the cap stops a single account from filling the table
const MAX_PASSKEYS: usize = 20;

/// List passkeys
///
/// The signed-in user's passkeys, oldest first.
#[utoipa::path(get, path = "/passkeys", responses(
    (status = OK, body = [PasskeyResponse]),
    (status = UNAUTHORIZED, body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn list(
    State(state): State<AppState>,
    session: Session,
) -> Result<impl IntoResponse, AppError> {
    let passkeys: Vec<PasskeyResponse> = db::passkeys::list(&state.pool, session.user.id)
        .await?
        .into_iter()
        .map(Into::into)
        .collect();
    // Personal data, so no shared cache may keep it and hand it to someone else
    let no_store = [(header::CACHE_CONTROL, HeaderValue::from_static("no-store"))];

    Ok((no_store, Json(passkeys)))
}

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
    reauth::confirm_password(&state, user.id, payload.password).await?;

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

/// Remove a passkey
///
/// Checks the password again, deletes one of the signed-in user's passkeys and emails the owner.
/// Answers 404 for a passkey that is not theirs.
#[utoipa::path(delete, path = "/passkeys/{id}", params(("id" = Uuid, Path)), request_body = ConfirmPasskeyChange, responses(
    (status = NO_CONTENT),
    (status = BAD_REQUEST, description = "Wrong password", body = ErrorBody),
    (status = UNAUTHORIZED, body = ErrorBody),
    (status = NOT_FOUND, body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn remove(
    State(state): State<AppState>,
    session: Session,
    id: Result<Path<Uuid>, PathRejection>,
    ValidatedJson(payload): ValidatedJson<ConfirmPasskeyChange>,
) -> Result<StatusCode, AppError> {
    // A malformed id names no passkey, same as someone else's
    let Ok(Path(id)) = id else {
        return Err(AppError::NotFound);
    };
    let user = session.user;
    reauth::confirm_password(&state, user.id, payload.password).await?;

    if !db::passkeys::delete(&state.pool, id, user.id).await? {
        return Err(AppError::NotFound);
    }

    let alert = templates::security_alert(SecurityEvent::PasskeyRemoved, &state.app_url)?;
    state.mailer.send_in_background(user.email, alert);

    Ok(StatusCode::NO_CONTENT)
}

/// Start signing in with a passkey
///
/// Returns the options for `navigator.credentials.get()`. The challenge stays on the server for
/// five minutes, named by a cookie.
#[utoipa::path(post, path = "/passkeys/signin/start", responses(
    (status = OK, body = PasskeyRequestOptions, headers(("set-cookie" = String, description = "Names this sign-in"))),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn start_sign_in(
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<(CookieJar, Json<PasskeyRequestOptions>), AppError> {
    let (options, authentication) = passkey::relying_party(&state.app_url)?
        .start_discoverable_authentication()
        .context("cannot start a passkey sign-in")?;

    let jar = passkey::begin(
        &state.pool,
        jar,
        Ceremony::Authentication,
        None,
        &authentication,
        state.secure_cookies(),
    )
    .await?;

    Ok((
        jar,
        Json(PasskeyRequestOptions {
            public_key: options.public_key,
        }),
    ))
}

/// Finish signing in with a passkey
///
/// Verifies the credential `navigator.credentials.get()` returned against the challenge from the
/// start and starts a session for its owner, set as an `HttpOnly` cookie. Passkeys always verify
/// the user, by PIN or biometrics, so this sign-in needs no second step. A challenge works once.
#[utoipa::path(post, path = "/passkeys/signin/finish", request_body = PasskeySignIn, responses(
    (status = OK, body = UserResponse, headers(("set-cookie" = String, description = "The session cookie"))),
    (status = BAD_REQUEST, body = ErrorBody),
    (status = UNAUTHORIZED, description = "Unknown passkey, failed verification, or the sign-in expired or already finished", body = ErrorBody),
    (status = FORBIDDEN, description = "The address is not verified yet", body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn finish_sign_in(
    State(state): State<AppState>,
    jar: CookieJar,
    ValidatedJson(payload): ValidatedJson<PasskeySignIn>,
) -> Result<(CookieJar, Json<UserResponse>), AppError> {
    let secure = state.secure_cookies();
    let authentication: DiscoverableAuthentication =
        passkey::finish(&state.pool, &jar, Ceremony::Authentication, None, secure)
            .await?
            .ok_or(AppError::PasskeySignInFailed)?;

    let webauthn = passkey::relying_party(&state.app_url)?;
    let credential = payload.credential;
    let (user_handle, credential_id) = webauthn
        .identify_discoverable_authentication(&credential)
        .map_err(|_| AppError::PasskeySignInFailed)?;

    let mut tx = state.pool.begin().await?;
    let (passkey_id, mut stored, user) = db::passkeys::find_for_update(&mut *tx, credential_id)
        .await?
        .ok_or(AppError::PasskeySignInFailed)?;
    // Registration set the user handle to the owner's id, so any other value is not this passkey's
    if user_handle != user.id {
        return Err(AppError::PasskeySignInFailed);
    }
    let result = webauthn
        .finish_discoverable_authentication(
            &credential,
            authentication,
            &[DiscoverableKey::from(&stored)],
        )
        .map_err(|error| {
            tracing::info!(?error, "passkey sign-in failed verification");
            AppError::PasskeySignInFailed
        })?;

    // Checked after the passkey, so only its holder learns the account's state
    if user.verified_at.is_none() {
        return Err(AppError::EmailNotVerified);
    }

    stored.update_credential(&result);
    db::passkeys::record_use(&mut *tx, passkey_id, &stored).await?;
    let jar = session::start(&mut *tx, jar, user.id, secure).await?;
    tx.commit().await?;

    Ok((
        cookie::PASSKEY_CEREMONY.clear(jar, secure),
        Json(user.into()),
    ))
}
