use anyhow::Context;
use axum::{
    Json,
    extract::State,
    http::{HeaderValue, StatusCode, header},
    response::IntoResponse,
};
use axum_extra::extract::cookie::CookieJar;
use chrono::Utc;
use sqlx::PgConnection;
use uuid::Uuid;

use super::dto::{
    AuthenticatorCode, PasswordConfirmation, RecoveryCode, RecoveryCodes, SecondFactor,
    TwoFactorSetup, TwoFactorStatus,
};
use crate::{
    AppState,
    auth::{
        cookie, reauth,
        session::{self, Session},
        token, two_factor,
    },
    crypto::Cipher,
    db::{self, users::User},
    email::templates::{self, SecurityEvent},
    error::{AppError, ErrorBody},
    extract::ValidatedJson,
    routes::auth::dto::UserResponse,
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
/// codes until `POST /two-factor/enable` confirms the app shows the right one, which it has 15
/// minutes to do. Starting again replaces a key that was never confirmed.
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
    reauth::confirm_password(&state, user.id, payload.password).await?;

    let secret = two_factor::new_secret()?;
    let totp = two_factor::totp(secret.as_slice(), &user.email)?;
    let sealed = two_factor::seal(&state.cipher, user.id, secret.as_slice())?;
    let mut tx = state.pool.begin().await?;
    // Takes turns with enabling, which could otherwise check its code against one key and turn on
    // the one saved here
    db::users::lock(&mut *tx, user.id).await?;
    if !db::two_factor::save_pending(&mut *tx, user.id, &sealed).await? {
        return Err(AppError::Conflict("Two-step verification is already on"));
    }
    tx.commit().await?;

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
/// someone else may already hold does not outlast the change. After five wrong codes the pending
/// key is deleted and the setup has to start again.
#[utoipa::path(post, path = "/two-factor/enable", request_body = AuthenticatorCode, responses(
    (status = OK, body = RecoveryCodes, headers(("set-cookie" = String, description = "A new session cookie"))),
    (status = BAD_REQUEST, description = "The code is wrong", body = ErrorBody),
    (status = UNAUTHORIZED, body = ErrorBody),
    (status = CONFLICT, description = "Already on, or no setup is waiting: it was never started, has expired or took five wrong codes", body = ErrorBody),
    (status = TOO_MANY_REQUESTS, description = "Too many writes from this client", body = ErrorBody, headers(("retry-after" = u64, description = "Seconds until another attempt is allowed"))),
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
    if db::two_factor::is_enabled(&mut *tx, user.id).await? {
        return Err(AppError::Conflict("Two-step verification is already on"));
    }
    let sealed = db::two_factor::find_pending(&mut *tx, user.id, two_factor::SETUP_TTL)
        .await?
        .ok_or(AppError::Conflict("Start the setup first"))?;
    let key = two_factor::open(&state.cipher, user.id, &sealed)?;
    let totp = two_factor::totp(&key, &user.email)?;
    let Some(step) = two_factor::verify_code(&totp, &payload.code, None) else {
        let attempts = db::two_factor::record_failed_setup_attempt(&mut *tx, user.id).await?;
        if attempts < two_factor::MAX_ATTEMPTS {
            // The request fails, but the attempt has to count
            tx.commit().await?;
            return Err(AppError::IncorrectCode("code"));
        }
        db::two_factor::delete_pending(&mut *tx, user.id).await?;
        tx.commit().await?;
        return Err(AppError::Conflict(
            "Too many wrong codes; start the setup again",
        ));
    };

    if !db::two_factor::enable(&mut *tx, user.id, &sealed, step).await? {
        return Err(AppError::Conflict("Start the setup first"));
    }
    let recovery_codes = replace_recovery_codes(&mut tx, user.id).await?;
    db::sessions::delete_for_user(&mut *tx, user.id).await?;
    let jar = session::start(&mut *tx, jar, user.id, state.secure_cookies()).await?;
    tx.commit().await?;

    alert(&state, user.email, SecurityEvent::TwoFactorEnabled)?;

    Ok((NO_STORE, jar, Json(RecoveryCodes { recovery_codes })))
}

/// Turn off two-step verification
///
/// Checks the password, then deletes the authenticator key and every recovery code, so signing in
/// asks for the password alone again.
#[utoipa::path(post, path = "/two-factor/disable", request_body = PasswordConfirmation, responses(
    (status = NO_CONTENT),
    (status = BAD_REQUEST, description = "The password is incorrect", body = ErrorBody),
    (status = UNAUTHORIZED, body = ErrorBody),
    (status = CONFLICT, description = "Two-step verification is already off", body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn disable_two_factor(
    State(state): State<AppState>,
    session: Session,
    ValidatedJson(payload): ValidatedJson<PasswordConfirmation>,
) -> Result<StatusCode, AppError> {
    let user = session.user;
    reauth::confirm_password(&state, user.id, payload.password).await?;

    let mut tx = state.pool.begin().await?;
    db::users::lock(&mut *tx, user.id).await?;
    if !db::two_factor::delete_secret(&mut *tx, user.id).await? {
        return Err(AppError::Conflict("Two-step verification is already off"));
    }
    db::two_factor::delete_recovery_codes(&mut *tx, user.id).await?;
    db::two_factor::delete_challenges_for_user(&mut *tx, user.id).await?;
    tx.commit().await?;

    alert(&state, user.email, SecurityEvent::TwoFactorDisabled)?;

    Ok(StatusCode::NO_CONTENT)
}

/// Replace the recovery codes
///
/// Checks the password, then returns ten new recovery codes. The earlier ones stop working, used
/// or not.
#[utoipa::path(post, path = "/two-factor/recovery-codes", request_body = PasswordConfirmation, responses(
    (status = OK, body = RecoveryCodes),
    (status = BAD_REQUEST, description = "The password is incorrect", body = ErrorBody),
    (status = UNAUTHORIZED, body = ErrorBody),
    (status = CONFLICT, description = "Two-step verification is off", body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn regenerate_recovery_codes(
    State(state): State<AppState>,
    session: Session,
    ValidatedJson(payload): ValidatedJson<PasswordConfirmation>,
) -> Result<impl IntoResponse, AppError> {
    let user = session.user;
    reauth::confirm_password(&state, user.id, payload.password).await?;

    let mut tx = state.pool.begin().await?;
    // Otherwise a concurrent disable could commit in between, and new codes would outlive it
    db::users::lock(&mut *tx, user.id).await?;
    if !db::two_factor::is_enabled(&mut *tx, user.id).await? {
        return Err(AppError::Conflict("Two-step verification is off"));
    }
    let recovery_codes = replace_recovery_codes(&mut tx, user.id).await?;
    tx.commit().await?;

    alert(&state, user.email, SecurityEvent::RecoveryCodesRegenerated)?;

    Ok((NO_STORE, Json(RecoveryCodes { recovery_codes })))
}

/// Finish signing in
///
/// Completes a sign-in that `POST /signin` answered with `two_factor_required`, using a code from
/// the authenticator app or a recovery code. Each code works once. After five wrong codes the
/// sign-in ends and has to start over from the password, and the owner is emailed, at most once
/// every 6 hours. An account takes 30 wrong codes a day, however many sign-ins they are spread
/// over; a right code or a password reset clears the count. A sign-in with a recovery code emails
/// the owner too.
#[utoipa::path(post, path = "/signin/two-factor", request_body = SecondFactor, responses(
    (status = OK, body = UserResponse, headers(("set-cookie" = String, description = "The session cookie"))),
    (status = BAD_REQUEST, description = "The code is wrong or was used already", body = ErrorBody),
    (status = UNAUTHORIZED, description = "No sign-in is waiting: it expired, ran out of attempts or never started", body = ErrorBody),
    (status = TOO_MANY_REQUESTS, description = "Too many writes from this client, or codes tried for this account", body = ErrorBody, headers(("retry-after" = u64, description = "Seconds until another attempt is allowed"))),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn verify_two_factor(
    State(state): State<AppState>,
    jar: CookieJar,
    ValidatedJson(payload): ValidatedJson<SecondFactor>,
) -> Result<(CookieJar, Json<UserResponse>), AppError> {
    let secure = state.secure_cookies();
    let token_hash = cookie::TWO_FACTOR
        .read(&jar, secure)
        .map(token::hash)
        .ok_or(AppError::SignInExpired)?;

    let mut tx = state.pool.begin().await?;
    let owner = db::two_factor::find_challenge(&mut *tx, &token_hash)
        .await?
        .ok_or(AppError::SignInExpired)?;
    // Attempts at this sign-in take turns. A password reset either commits first and takes the
    // challenge with it, hence the second read, or waits and then ends the session started here.
    db::users::lock(&mut *tx, owner.id).await?;
    let user = db::two_factor::find_challenge(&mut *tx, &token_hash)
        .await?
        .ok_or(AppError::SignInExpired)?;
    // Turning two-step verification off since the password step ends the sign-in too
    let secret = db::two_factor::find_secret(&mut *tx, user.id)
        .await?
        .filter(|secret| secret.enabled)
        .ok_or(AppError::SignInExpired)?;
    // Per account rather than per challenge, since a new challenge costs only the password
    let blocked = db::two_factor::wrong_codes_until(
        &mut *tx,
        user.id,
        two_factor::WRONG_CODE_LIMIT,
        two_factor::WRONG_CODE_WINDOW,
    )
    .await?;
    if let Some(closes) = blocked {
        let wait = (closes - Utc::now()).to_std().unwrap_or_default();
        return Err(AppError::TooManyRequests(wait));
    }

    if !spend(&mut tx, &state.cipher, &user, &secret, &payload).await? {
        db::two_factor::record_wrong_code(&mut *tx, user.id, two_factor::WRONG_CODE_WINDOW).await?;
        let attempts = db::two_factor::record_failed_attempt(&mut *tx, &token_hash).await?;
        if attempts < two_factor::MAX_ATTEMPTS {
            // The request fails, but the attempt has to count
            tx.commit().await?;
            return Err(AppError::IncorrectCode(payload.field()));
        }
        db::two_factor::delete_challenge(&mut *tx, &token_hash).await?;
        tx.commit().await?;
        // Whoever got this far had the password, and the owner needs to know it leaked
        if state.rate_limits.wrong_codes_alert(user.id) {
            alert(&state, user.email, SecurityEvent::TooManyWrongCodes)?;
        }
        return Err(AppError::SignInExpired);
    }

    db::two_factor::delete_challenge(&mut *tx, &token_hash).await?;
    db::two_factor::clear_wrong_codes(&mut *tx, user.id).await?;
    let recovery_codes_left = if matches!(payload, SecondFactor::RecoveryCode(_)) {
        Some(
            db::two_factor::status(&mut *tx, user.id)
                .await?
                .recovery_codes_remaining,
        )
    } else {
        None
    };
    let jar = cookie::TWO_FACTOR.clear(jar, secure);
    let jar = session::start(&mut *tx, jar, user.id, secure).await?;
    tx.commit().await?;

    // Unlike an app code, a recovery code works without the owner's phone
    if let Some(remaining) = recovery_codes_left {
        let event = SecurityEvent::RecoveryCodeUsed { remaining };
        alert(&state, user.email.clone(), event)?;
    }

    Ok((jar, Json(user.into())))
}

/// Uses up the code when it checks out; returns whether it did
async fn spend(
    conn: &mut PgConnection,
    cipher: &Cipher,
    user: &User,
    secret: &db::two_factor::Secret,
    second_factor: &SecondFactor,
) -> Result<bool, AppError> {
    match second_factor {
        SecondFactor::Code(AuthenticatorCode { code }) => {
            let key = two_factor::open(cipher, user.id, &secret.sealed)?;
            let totp = two_factor::totp(&key, &user.email)?;
            match two_factor::verify_code(&totp, code, secret.last_used_step) {
                Some(step) => Ok(db::two_factor::record_step(conn, user.id, step).await?),
                None => Ok(false),
            }
        }
        SecondFactor::RecoveryCode(RecoveryCode { recovery_code }) => {
            let hashes = db::two_factor::unused_recovery_codes(&mut *conn, user.id).await?;
            match two_factor::find_recovery_code(user.id, recovery_code, &hashes) {
                Some(hash) => Ok(db::two_factor::use_recovery_code(conn, user.id, hash).await?),
                None => Ok(false),
            }
        }
    }
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
