use chrono::Utc;
use sqlx::PgExecutor;
use uuid::Uuid;

use crate::auth::token::Purpose;

pub async fn insert(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
    user_id: Uuid,
    purpose: Purpose,
) -> sqlx::Result<()> {
    sqlx::query!(
        "INSERT INTO user_tokens (token_hash, user_id, purpose, expires_at) VALUES ($1, $2, $3, $4)",
        token_hash,
        user_id,
        purpose.as_str(),
        Utc::now() + purpose.ttl()
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Whether a link for `purpose` went to this user in the last minute
pub async fn issued_recently(
    db: impl PgExecutor<'_>,
    user_id: Uuid,
    purpose: Purpose,
) -> sqlx::Result<bool> {
    sqlx::query_scalar!(
        r#"SELECT EXISTS (
            SELECT 1 FROM user_tokens
            WHERE user_id = $1 AND purpose = $2 AND created_at > now() - interval '1 minute'
        ) AS "exists!""#,
        user_id,
        purpose.as_str()
    )
    .fetch_one(db)
    .await
}

/// Deletes the token and returns its user, or `None` when it is unknown, expired, already used,
/// or was issued for a different purpose
pub async fn consume(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
    purpose: Purpose,
) -> sqlx::Result<Option<Uuid>> {
    sqlx::query_scalar!(
        "DELETE FROM user_tokens WHERE token_hash = $1 AND purpose = $2 AND expires_at > now() \
         RETURNING user_id",
        token_hash,
        purpose.as_str()
    )
    .fetch_optional(db)
    .await
}

pub async fn delete_for_user(
    db: impl PgExecutor<'_>,
    user_id: Uuid,
    purpose: Purpose,
) -> sqlx::Result<()> {
    sqlx::query!(
        "DELETE FROM user_tokens WHERE user_id = $1 AND purpose = $2",
        user_id,
        purpose.as_str()
    )
    .execute(db)
    .await?;

    Ok(())
}

pub async fn delete_all_for_user(db: impl PgExecutor<'_>, user_id: Uuid) -> sqlx::Result<()> {
    sqlx::query!("DELETE FROM user_tokens WHERE user_id = $1", user_id)
        .execute(db)
        .await?;

    Ok(())
}

pub async fn delete_expired(db: impl PgExecutor<'_>) -> sqlx::Result<u64> {
    let result = sqlx::query!("DELETE FROM user_tokens WHERE expires_at <= now()")
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}
