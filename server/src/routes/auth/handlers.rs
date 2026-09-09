use axum::{Json, extract::State};

use super::dto::{SignupRequest, SignupResponse};
use crate::{
    AppState,
    error::{AppError, ErrorBody},
    extract::ValidatedJson,
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
    ValidatedJson(payload): ValidatedJson<SignupRequest>,
) -> Result<Json<SignupResponse>, AppError> {
    Ok(Json(SignupResponse {
        id: uuid::Uuid::new_v4(),
        email: payload.email,
        verified_at: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }))
}
