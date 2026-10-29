use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

use crate::db;

/// The account password, asked again before a change to two-step verification
#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct PasswordConfirmation {
    #[validate(length(min = 1, max = 128, message = "must be between 1 and 128 characters"))]
    pub password: String,
}

#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct AuthenticatorCode {
    /// The 6-digit code the authenticator app shows
    #[validate(length(min = 1, max = 16, message = "must be between 1 and 16 characters"))]
    pub code: String,
}

#[derive(Serialize, ToSchema)]
pub(super) struct RecoveryCodes {
    /// Each signs in once in place of an authenticator code. The server keeps only their hashes,
    /// so this response is the one time they are shown.
    pub recovery_codes: Vec<String>,
}

#[derive(Serialize, ToSchema)]
pub(super) struct TwoFactorStatus {
    pub enabled: bool,
    /// Unused recovery codes; 0 while two-step verification is off
    pub recovery_codes_remaining: i64,
}

impl From<db::two_factor::Status> for TwoFactorStatus {
    fn from(value: db::two_factor::Status) -> Self {
        Self {
            enabled: value.enabled,
            recovery_codes_remaining: value.recovery_codes_remaining,
        }
    }
}

/// What an authenticator app needs to start showing codes for the account
#[derive(Serialize, ToSchema)]
pub(super) struct TwoFactorSetup {
    /// Adds the account to an app that opens `otpauth://` links
    pub otpauth_url: String,
    /// The key in base32, for typing into an app by hand
    pub secret: String,
    /// `otpauth_url` as a QR code: an SVG image in a `data:` URL
    pub qr_code: String,
}
