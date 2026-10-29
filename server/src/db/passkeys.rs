use chrono::{DateTime, Utc};
use sqlx::{PgExecutor, types::Json};
use uuid::Uuid;
use webauthn_rs::prelude::Passkey;

use super::users::User;

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

pub async fn list(db: impl PgExecutor<'_>, user_id: Uuid) -> sqlx::Result<Vec<SavedPasskey>> {
    sqlx::query_as!(
        SavedPasskey,
        "SELECT id, name, created_at, last_used_at FROM passkeys WHERE user_id = $1 \
         ORDER BY created_at, id",
        user_id
    )
    .fetch_all(db)
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

/// The passkey's id, its credential and its owner. The row stays locked until the transaction
/// ends, so concurrent sign-ins with one passkey check its signature counter one at a time.
pub async fn find_for_update(
    db: impl PgExecutor<'_>,
    credential_id: &[u8],
) -> sqlx::Result<Option<(Uuid, Passkey, User)>> {
    let row = sqlx::query!(
        r#"SELECT p.id AS passkey_id, p.passkey AS "passkey: Json<Passkey>",
            u.id, u.email, u.verified_at, u.created_at, u.updated_at
        FROM passkeys p JOIN users u ON u.id = p.user_id
        WHERE p.credential_id = $1
        FOR UPDATE OF p"#,
        credential_id
    )
    .fetch_optional(db)
    .await?;

    Ok(row.map(|row| {
        let user = User {
            id: row.id,
            email: row.email,
            verified_at: row.verified_at,
            created_at: row.created_at,
            updated_at: row.updated_at,
        };
        (row.passkey_id, row.passkey.0, user)
    }))
}

/// Saves the credential as a sign-in left it, counter and backup state included
pub async fn record_use(db: impl PgExecutor<'_>, id: Uuid, passkey: &Passkey) -> sqlx::Result<()> {
    sqlx::query!(
        "UPDATE passkeys SET passkey = $2, last_used_at = now() WHERE id = $1",
        id,
        Json(passkey) as _
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Deletes the passkey only when it belongs to `user_id`; `false` when no such passkey does
pub async fn delete(db: impl PgExecutor<'_>, id: Uuid, user_id: Uuid) -> sqlx::Result<bool> {
    let result = sqlx::query!(
        "DELETE FROM passkeys WHERE id = $1 AND user_id = $2",
        id,
        user_id
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() == 1)
}
