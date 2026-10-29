use chrono::{TimeDelta, Utc};
use sqlx::{PgConnection, PgExecutor};
use uuid::Uuid;

use super::users::User;

pub struct Status {
    pub enabled: bool,
    pub recovery_codes_remaining: i64,
}

pub struct Secret {
    /// Sealed by `crypto::Cipher`
    pub sealed: Vec<u8>,
    pub enabled: bool,
    pub last_used_step: Option<i64>,
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

pub async fn is_enabled(db: impl PgExecutor<'_>, user_id: Uuid) -> sqlx::Result<bool> {
    sqlx::query_scalar!(
        r#"SELECT EXISTS (
            SELECT 1 FROM totp_secrets WHERE user_id = $1 AND enabled_at IS NOT NULL
        ) AS "exists!""#,
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
         SET secret = EXCLUDED.secret, last_used_step = NULL, setup_attempts = 0, \
             created_at = now() \
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
        r#"SELECT secret AS sealed, enabled_at IS NOT NULL AS "enabled!", last_used_step
           FROM totp_secrets WHERE user_id = $1"#,
        user_id
    )
    .fetch_optional(db)
    .await
}

/// The sealed key of a setup started less than `ttl` ago that no code has confirmed yet
pub async fn find_pending(
    db: impl PgExecutor<'_>,
    user_id: Uuid,
    ttl: TimeDelta,
) -> sqlx::Result<Option<Vec<u8>>> {
    sqlx::query_scalar!(
        "SELECT secret FROM totp_secrets \
         WHERE user_id = $1 AND enabled_at IS NULL AND created_at > $2",
        user_id,
        Utc::now() - ttl
    )
    .fetch_optional(db)
    .await
}

/// Counts a wrong code against the pending setup and returns how many it has had
pub async fn record_failed_setup_attempt(
    db: impl PgExecutor<'_>,
    user_id: Uuid,
) -> sqlx::Result<i16> {
    sqlx::query_scalar!(
        "UPDATE totp_secrets SET setup_attempts = setup_attempts + 1 \
         WHERE user_id = $1 AND enabled_at IS NULL RETURNING setup_attempts",
        user_id
    )
    .fetch_one(db)
    .await
}

pub async fn delete_pending(db: impl PgExecutor<'_>, user_id: Uuid) -> sqlx::Result<()> {
    sqlx::query!(
        "DELETE FROM totp_secrets WHERE user_id = $1 AND enabled_at IS NULL",
        user_id
    )
    .execute(db)
    .await?;

    Ok(())
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

/// Records the step of a code that just worked. Returns `false` when that step, or a later one,
/// was recorded already, which makes the code a replay.
pub async fn record_step(db: impl PgExecutor<'_>, user_id: Uuid, step: i64) -> sqlx::Result<bool> {
    let result = sqlx::query!(
        "UPDATE totp_secrets SET last_used_step = $2 \
         WHERE user_id = $1 AND enabled_at IS NOT NULL \
         AND (last_used_step IS NULL OR last_used_step < $2)",
        user_id,
        step
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() == 1)
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

pub async fn unused_recovery_codes(
    db: impl PgExecutor<'_>,
    user_id: Uuid,
) -> sqlx::Result<Vec<Vec<u8>>> {
    sqlx::query_scalar!(
        "SELECT code_hash FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL",
        user_id
    )
    .fetch_all(db)
    .await
}

/// Returns `false` when the code was used already
pub async fn use_recovery_code(
    db: impl PgExecutor<'_>,
    user_id: Uuid,
    code_hash: &[u8],
) -> sqlx::Result<bool> {
    let result = sqlx::query!(
        "UPDATE recovery_codes SET used_at = now() \
         WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL",
        user_id,
        code_hash
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected() == 1)
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
    delete_recovery_codes(&mut *conn, user_id).await?;
    sqlx::query!(
        "INSERT INTO recovery_codes (user_id, code_hash) SELECT $1, unnest($2::bytea[])",
        user_id,
        &hashes
    )
    .execute(&mut *conn)
    .await?;

    Ok(())
}

/// Inserts the challenge only while `password_hash` is still the user's password, for the reason
/// `sessions::insert_if_password` gives
pub async fn insert_challenge_if_password(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
    user_id: Uuid,
    password_hash: &str,
    ttl: TimeDelta,
) -> sqlx::Result<bool> {
    let result = sqlx::query!(
        "INSERT INTO two_factor_challenges (token_hash, user_id, expires_at) \
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

/// The user whose sign-in the challenge holds, or `None` when it is unknown, expired or used up
pub async fn find_challenge(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
) -> sqlx::Result<Option<User>> {
    sqlx::query_as!(
        User,
        "SELECT u.id, u.email, u.verified_at, u.created_at, u.updated_at \
         FROM two_factor_challenges c JOIN users u ON u.id = c.user_id \
         WHERE c.token_hash = $1 AND c.expires_at > now()",
        token_hash
    )
    .fetch_optional(db)
    .await
}

/// Counts a wrong code against the challenge and returns how many it has had
pub async fn record_failed_attempt(
    db: impl PgExecutor<'_>,
    token_hash: &[u8],
) -> sqlx::Result<i16> {
    sqlx::query_scalar!(
        "UPDATE two_factor_challenges SET attempts = attempts + 1 WHERE token_hash = $1 \
         RETURNING attempts",
        token_hash
    )
    .fetch_one(db)
    .await
}

pub async fn delete_challenges_for_user(
    db: impl PgExecutor<'_>,
    user_id: Uuid,
) -> sqlx::Result<()> {
    sqlx::query!(
        "DELETE FROM two_factor_challenges WHERE user_id = $1",
        user_id
    )
    .execute(db)
    .await?;

    Ok(())
}

pub async fn delete_expired_challenges(db: impl PgExecutor<'_>) -> sqlx::Result<u64> {
    let result = sqlx::query!("DELETE FROM two_factor_challenges WHERE expires_at <= now()")
        .execute(db)
        .await?;

    Ok(result.rows_affected())
}

/// Deletes setups started `ttl` ago or longer that no code confirmed
pub async fn delete_expired_setups(db: impl PgExecutor<'_>, ttl: TimeDelta) -> sqlx::Result<u64> {
    let result = sqlx::query!(
        "DELETE FROM totp_secrets WHERE enabled_at IS NULL AND created_at <= $1",
        Utc::now() - ttl
    )
    .execute(db)
    .await?;

    Ok(result.rows_affected())
}

pub async fn delete_challenge(db: impl PgExecutor<'_>, token_hash: &[u8]) -> sqlx::Result<()> {
    sqlx::query!(
        "DELETE FROM two_factor_challenges WHERE token_hash = $1",
        token_hash
    )
    .execute(db)
    .await?;

    Ok(())
}
