use chrono::{TimeDelta, Utc};
use serde::{Serialize, de::DeserializeOwned};
use sqlx::{PgExecutor, types::Json};
use uuid::Uuid;

use crate::auth::passkey::Ceremony;

pub async fn insert<T: Serialize + Sync>(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
    ceremony: Ceremony,
    user_id: Option<Uuid>,
    state: &T,
    ttl: TimeDelta,
) -> sqlx::Result<()> {
    sqlx::query!(
        "INSERT INTO passkey_ceremonies (token_hash, kind, user_id, state, expires_at) \
         VALUES ($1, $2, $3, $4, $5)",
        token_hash,
        ceremony.as_str(),
        user_id,
        Json(state) as _,
        Utc::now() + ttl
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Deletes the ceremony and returns its state, or `None` when it is unknown, expired, already
/// finished, or was started as another kind of ceremony or by another user
pub async fn consume<T: DeserializeOwned + Send + Unpin + 'static>(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
    ceremony: Ceremony,
    user_id: Option<Uuid>,
) -> sqlx::Result<Option<T>> {
    let state = sqlx::query_scalar!(
        r#"DELETE FROM passkey_ceremonies
        WHERE token_hash = $1 AND kind = $2 AND user_id IS NOT DISTINCT FROM $3
            AND expires_at > now()
        RETURNING state AS "state: Json<T>""#,
        token_hash,
        ceremony.as_str(),
        user_id
    )
    .fetch_optional(db)
    .await?;

    Ok(state.map(|state| state.0))
}

pub async fn delete(db: impl PgExecutor<'_>, token_hash: &[u8]) -> sqlx::Result<()> {
    sqlx::query!(
        "DELETE FROM passkey_ceremonies WHERE token_hash = $1",
        token_hash
    )
    .execute(db)
    .await?;

    Ok(())
}

pub async fn delete_expired(db: impl PgExecutor<'_>) -> sqlx::Result<u64> {
    let result = sqlx::query!("DELETE FROM passkey_ceremonies WHERE expires_at <= now()")
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}
