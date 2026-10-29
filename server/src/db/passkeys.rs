use chrono::{DateTime, Utc};
use sqlx::{PgExecutor, types::Json};
use uuid::Uuid;
use webauthn_rs::prelude::Passkey;

/// What the owner sees of a passkey; the credential itself stays in the database
pub struct SavedPasskey {
    pub id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
}

pub async fn insert(
    db: impl PgExecutor<'_>,
    user_id: Uuid,
    passkey: &Passkey,
    name: &str,
) -> sqlx::Result<SavedPasskey> {
    sqlx::query_as!(
        SavedPasskey,
        "INSERT INTO passkeys (user_id, credential_id, passkey, name) VALUES ($1, $2, $3, $4) \
         RETURNING id, name, created_at, last_used_at",
        user_id,
        passkey.cred_id().as_ref(),
        Json(passkey) as _,
        name
    )
    .fetch_one(db)
    .await
}

pub async fn credential_ids(db: impl PgExecutor<'_>, user_id: Uuid) -> sqlx::Result<Vec<Vec<u8>>> {
    sqlx::query_scalar!(
        "SELECT credential_id FROM passkeys WHERE user_id = $1",
        user_id
    )
    .fetch_all(db)
    .await
}
