use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct SignupRequest {
    #[validate(email(message = "must be a valid email address"))]
    #[schema(format = "email", example = "user@example.com")]
    pub(super) email: String,
    #[validate(length(
        min = 8,
        max = 128,
        message = "password must be between 8 and 128 characters"
    ))]
    #[schema(min_length = 8, max_length = 128)]
    pub(super) password: String,
}

#[derive(Serialize, ToSchema)]
pub(super) struct SignupResponse {
    pub(super) id: Uuid,
    pub(super) email: String,
    pub(super) verified_at: Option<DateTime<Utc>>,
    pub(super) created_at: DateTime<Utc>,
    pub(super) updated_at: DateTime<Utc>,
}
