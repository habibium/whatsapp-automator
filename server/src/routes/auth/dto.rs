use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::db;

#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct Credentials {
    #[validate(email(message = "must be a valid email address"))]
    pub email: String,
    #[validate(length(min = 8, max = 128, message = "must be between 8 and 128 characters"))]
    pub password: String,
}

#[derive(Serialize, ToSchema)]
pub(super) struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<db::users::User> for UserResponse {
    fn from(value: db::users::User) -> Self {
        Self {
            id: value.id,
            email: value.email,
            verified_at: value.verified_at,
            created_at: value.created_at,
            updated_at: value.updated_at,
        }
    }
}
