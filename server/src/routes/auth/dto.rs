use chrono::{DateTime, Utc};
use lettre::Address;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::{Validate, ValidationError};

use crate::db;

#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct Credentials {
    #[validate(
        email(message = "must be a valid email address"),
        custom(function = "mailable", message = "must be a valid email address")
    )]
    pub email: String,
    #[validate(length(min = 8, max = 128, message = "must be between 8 and 128 characters"))]
    pub password: String,
}

// Any length up to the cap: tightening the sign-up rule later must not lock out existing passwords
#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct SignInCredentials {
    #[validate(email(message = "must be a valid email address"))]
    pub email: String,
    #[validate(length(min = 1, max = 128, message = "must be between 1 and 128 characters"))]
    pub password: String,
}

#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct EmailAddress {
    #[validate(email(message = "must be a valid email address"))]
    pub email: String,
}

/// The token from an emailed link
#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct EmailToken {
    #[validate(length(min = 1, max = 128, message = "must be between 1 and 128 characters"))]
    pub token: String,
}

#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct PasswordReset {
    /// The token from the reset email's link
    #[validate(length(min = 1, max = 128, message = "must be between 1 and 128 characters"))]
    pub token: String,
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

#[derive(Serialize, ToSchema)]
pub(super) struct EmailVerified {
    pub user: UserResponse,
    /// Only the browser that signed up is signed in by the link; any other has to sign in
    pub signed_in: bool,
}

#[derive(Serialize, ToSchema)]
pub(super) struct SessionResponse {
    /// `null` when nobody is signed in
    #[schema(required = true)]
    pub user: Option<UserResponse>,
}

/// The `email` rule accepts some addresses the mailer cannot send to, such as `a..b@example.com`;
/// an account at one could never be verified.
fn mailable(email: &str) -> Result<(), ValidationError> {
    email
        .parse::<Address>()
        .map(drop)
        .map_err(|_| ValidationError::new("mailable"))
}
