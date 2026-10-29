use chrono::{DateTime, TimeDelta, Utc};
use sqlx::PgExecutor;
use uuid::Uuid;

use super::users::User;

pub async fn insert(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
    user_id: Uuid,
    ttl: TimeDelta,
) -> sqlx::Result<()> {
    sqlx::query!(
        "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
        token_hash,
        user_id,
        Utc::now() + ttl
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Inserts the session only while `password_hash` is still the user's password. The row lock
/// makes a concurrent password change either wait for this insert, then delete the session, or
/// commit first and leave nothing to insert.
pub async fn insert_if_password(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
    user_id: Uuid,
    password_hash: &str,
    ttl: TimeDelta,
) -> sqlx::Result<bool> {
    let result = sqlx::query!(
        "INSERT INTO sessions (token_hash, user_id, expires_at) \
         SELECT $1, id, $3 FROM users WHERE id = $2 AND password = $4 FOR SHARE",
        token_hash,
        user_id,
        Utc::now() + ttl,
        password_hash
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() == 1)
}

/// The session's user and expiry, or `None` when the session is unknown or expired
pub async fn find(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
) -> sqlx::Result<Option<(User, DateTime<Utc>)>> {
    let row = sqlx::query!(
        "SELECT u.id, u.email, u.verified_at, u.created_at, u.updated_at, s.expires_at \
         FROM sessions s JOIN users u ON u.id = s.user_id \
         WHERE s.token_hash = $1 AND s.expires_at > now()",
        token_hash
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
        (user, row.expires_at)
    }))
}

pub async fn extend(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
    ttl: TimeDelta,
) -> sqlx::Result<()> {
    sqlx::query!(
        "UPDATE sessions SET expires_at = $2 WHERE token_hash = $1",
        token_hash,
        Utc::now() + ttl
    )
    .execute(db)
    .await?;

    Ok(())
}

pub async fn delete(db: impl PgExecutor<'_>, token_hash: &[u8]) -> sqlx::Result<()> {
    sqlx::query!("DELETE FROM sessions WHERE token_hash = $1", token_hash)
        .execute(db)
        .await?;

    Ok(())
}

pub async fn delete_for_user(db: impl PgExecutor<'_>, user_id: Uuid) -> sqlx::Result<()> {
    sqlx::query!("DELETE FROM sessions WHERE user_id = $1", user_id)
        .execute(db)
        .await?;

    Ok(())
}

pub async fn delete_expired(db: impl PgExecutor<'_>) -> sqlx::Result<u64> {
    let result = sqlx::query!("DELETE FROM sessions WHERE expires_at <= now()")
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}
