use sqlx::PgExecutor;
use uuid::Uuid;

pub struct Status {
    pub enabled: bool,
    pub recovery_codes_remaining: i64,
}

pub async fn status(db: impl PgExecutor<'_>, user_id: Uuid) -> sqlx::Result<Status> {
    sqlx::query_as!(
        Status,
        r#"SELECT
            EXISTS (
                SELECT 1 FROM totp_secrets WHERE user_id = $1 AND enabled_at IS NOT NULL
            ) AS "enabled!",
            (
                SELECT count(*) FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL
            ) AS "recovery_codes_remaining!""#,
        user_id
    )
    .fetch_one(db)
    .await
}

/// Saves a key that waits for its first code, replacing any earlier pending one. Returns `false`
/// and changes nothing when two-step verification is already on.
pub async fn save_pending(
    db: impl PgExecutor<'_>,
    user_id: Uuid,
    sealed_secret: &[u8],
) -> sqlx::Result<bool> {
    let result = sqlx::query!(
        "INSERT INTO totp_secrets (user_id, secret) VALUES ($1, $2) \
         ON CONFLICT (user_id) DO UPDATE \
         SET secret = EXCLUDED.secret, last_used_step = NULL, created_at = now() \
         WHERE totp_secrets.enabled_at IS NULL",
        user_id,
        sealed_secret
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() == 1)
}
