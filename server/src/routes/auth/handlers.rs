use axum::{Json, extract::State};

use super::{
    dto::{AuthRequest, AuthResponse},
    password,
};
use crate::{
    AppState, db,
    error::{AppError, ErrorBody},
    extract::ValidatedJson,
};

/// Sign up
///
/// Sign up a user with email & password
#[utoipa::path(post, path = "/signup", request_body = AuthRequest, responses(
    (status = OK, body = AuthResponse),
    (status = BAD_REQUEST, body = ErrorBody),
    (status = CONFLICT, body = ErrorBody),
    (status = INTERNAL_SERVER_ERROR, body = ErrorBody),
))]
pub async fn signup(
    State(state): State<AppState>,
    ValidatedJson(payload): ValidatedJson<AuthRequest>,
) -> Result<Json<AuthResponse>, AppError> {
    let password_hash = password::hash(payload.password).await?;

    let user = db::users::insert(
        &state.pool,
        payload.email.trim().to_lowercase(),
        password_hash,
    )
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(db_err) if db_err.is_unique_violation() => {
            AppError::Conflict("Email already registered")
        }
        e => e.into(),
    })?;

    Ok(Json(user.into()))
}
