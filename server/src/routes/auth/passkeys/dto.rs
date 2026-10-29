use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;
use webauthn_rs::prelude::{PublicKeyCredential, RegisterPublicKeyCredential};
use webauthn_rs_proto::{PublicKeyCredentialCreationOptions, PublicKeyCredentialRequestOptions};

use crate::db;

/// The account password, asked again before a passkey is added or removed
#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct ConfirmPasskeyChange {
    #[validate(length(min = 1, max = 128, message = "must be between 1 and 128 characters"))]
    pub password: String,
}

/// Options for `navigator.credentials.create()`
#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub(super) struct PasskeyCreationOptions {
    /// For `PublicKeyCredential.parseCreationOptionsFromJSON`
    #[schema(value_type = std::collections::HashMap<String, serde_json::Value>)]
    pub public_key: PublicKeyCredentialCreationOptions,
}

/// Options for `navigator.credentials.get()`. They name no account, so the browser offers every
/// passkey it holds for this site; the page picks the mediation, modal or conditional.
#[derive(Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub(super) struct PasskeyRequestOptions {
    /// For `PublicKeyCredential.parseRequestOptionsFromJSON`
    #[schema(value_type = std::collections::HashMap<String, serde_json::Value>)]
    pub public_key: PublicKeyCredentialRequestOptions,
}

#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct NewPasskey {
    /// `toJSON()` of the credential `navigator.credentials.create()` made
    #[schema(value_type = std::collections::HashMap<String, serde_json::Value>)]
    pub credential: RegisterPublicKeyCredential,
    /// Tells the user's passkeys apart; blank or left out, it is "Passkey"
    #[validate(length(max = 64, message = "must be at most 64 characters"))]
    pub name: Option<String>,
}

#[derive(Deserialize, Validate, ToSchema)]
pub(super) struct PasskeySignIn {
    /// `toJSON()` of the credential `navigator.credentials.get()` returned
    #[schema(value_type = std::collections::HashMap<String, serde_json::Value>)]
    pub credential: PublicKeyCredential,
}

#[derive(Serialize, ToSchema)]
pub(super) struct PasskeyResponse {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    /// `null` until the passkey first signs in
    #[schema(required = true)]
    pub last_used_at: Option<DateTime<Utc>>,
}

impl From<db::passkeys::SavedPasskey> for PasskeyResponse {
    fn from(value: db::passkeys::SavedPasskey) -> Self {
        Self {
            id: value.id,
            name: value.name,
            created_at: value.created_at,
            last_used_at: value.last_used_at,
        }
    }
}
