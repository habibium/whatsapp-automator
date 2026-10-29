use sqlx::{PgConnection, PgExecutor};
use uuid::Uuid;

pub struct Status {
    pub enabled: bool,
    pub recovery_codes_remaining: i64,
}

pub struct Secret {
    /// Sealed by `crypto::Cipher`
    pub sealed: Vec<u8>,
    pub enabled: bool,
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

pub async fn find_secret(db: impl PgExecutor<'_>, user_id: Uuid) -> sqlx::Result<Option<Secret>> {
    sqlx::query_as!(
        Secret,
        r#"SELECT secret AS sealed, enabled_at IS NOT NULL AS "enabled!"
           FROM totp_secrets WHERE user_id = $1"#,
        user_id
    )
    .fetch_optional(db)
    .await
}

/// `step` is the confirming code's, so that code cannot sign in afterwards
pub async fn enable(db: impl PgExecutor<'_>, user_id: Uuid, step: i64) -> sqlx::Result<()> {
    sqlx::query!(
        "UPDATE totp_secrets SET enabled_at = now(), last_used_step = $2 WHERE user_id = $1",
        user_id,
        step
    )
    .execute(db)
    .await?;

    Ok(())
}

/// Deletes the key, pending or not. Returns whether two-step verification was on.
pub async fn delete_secret(db: impl PgExecutor<'_>, user_id: Uuid) -> sqlx::Result<bool> {
    let enabled = sqlx::query_scalar!(
        r#"DELETE FROM totp_secrets WHERE user_id = $1 RETURNING enabled_at IS NOT NULL AS "enabled!""#,
        user_id
    )
    .fetch_optional(db)
    .await?;

    Ok(enabled == Some(true))
}

pub async fn delete_recovery_codes(db: impl PgExecutor<'_>, user_id: Uuid) -> sqlx::Result<()> {
    sqlx::query!("DELETE FROM recovery_codes WHERE user_id = $1", user_id)
        .execute(db)
        .await?;

    Ok(())
}

/// Replaces every recovery code of the user, used or not
pub async fn replace_recovery_codes(
    conn: &mut PgConnection,
    user_id: Uuid,
    hashes: &[[u8; 32]],
) -> sqlx::Result<()> {
    let hashes: Vec<Vec<u8>> = hashes.iter().map(|hash| hash.to_vec()).collect();
    sqlx::query!("DELETE FROM recovery_codes WHERE user_id = $1", user_id)
        .execute(&mut *conn)
        .await?;
    sqlx::query!(
        "INSERT INTO recovery_codes (user_id, code_hash) SELECT $1, unnest($2::bytea[])",
        user_id,
        &hashes
    )
    .execute(&mut *conn)
    .await?;

    Ok(())
}
