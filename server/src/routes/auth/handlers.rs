use axum::{Json, extract::State};
use validator::Validate;

use super::dto::{SignupRequest, SignupResponse};
use crate::{
    AppState,
    error::{AppError, ErrorBody},
};

/// Sign up
///
/// Sign up a user with email & password
#[utoipa::path(post, path = "/signup", request_body = SignupRequest, responses(
    (status = OK, body = SignupResponse),
    (status = BAD_REQUEST, body = ErrorBody),
))]
pub async fn signup(
    State(state): State<AppState>,
    Json(payload): Json<SignupRequest>,
) -> Result<Json<SignupResponse>, AppError> {
    payload.validate()?;

    Ok(Json(SignupResponse {
        id: uuid::Uuid::new_v4(),
        email: payload.email,
        verified_at: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }))
}
