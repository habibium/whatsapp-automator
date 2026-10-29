use chrono::{DateTime, Utc};
use sqlx::PgExecutor;
use uuid::Uuid;

#[derive(Debug)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// `signup_binding_hash` identifies the browser that signed up, until the address is verified
pub async fn insert(
    db: impl PgExecutor<'_>,
    email: &str,
    password_hash: &str,
    signup_binding_hash: &[u8],
) -> sqlx::Result<User> {
    sqlx::query_as!(
        User,
        "INSERT INTO users (email, password, signup_binding_hash) VALUES ($1, $2, $3) \
         RETURNING id, email, verified_at, created_at, updated_at",
        email,
        password_hash,
        signup_binding_hash
    )
    .fetch_one(db)
    .await
}

pub async fn find_by_email(db: impl PgExecutor<'_>, email: &str) -> sqlx::Result<Option<User>> {
    sqlx::query_as!(
        User,
        "SELECT id, email, verified_at, created_at, updated_at FROM users WHERE email = $1",
        email
    )
    .fetch_optional(db)
    .await
}

/// The user and their password hash, which `User` leaves out so it can never reach a response
pub async fn find_with_password(
    db: impl PgExecutor<'_>,
    email: &str,
) -> sqlx::Result<Option<(User, String)>> {
    let row = sqlx::query!(
        "SELECT id, email, password, verified_at, created_at, updated_at FROM users WHERE email = $1",
        email
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
        (user, row.password)
    }))
}

/// Holds the user's row until the transaction ends, so concurrent requests for the same user
/// take turns. `NO KEY` leaves inserts that reference the user unblocked.
pub async fn lock(db: impl PgExecutor<'_>, id: Uuid) -> sqlx::Result<()> {
    sqlx::query!("SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE", id)
        .fetch_optional(db)
        .await?;

    Ok(())
}

pub async fn password_hash(db: impl PgExecutor<'_>, id: Uuid) -> sqlx::Result<String> {
    sqlx::query_scalar!("SELECT password FROM users WHERE id = $1", id)
        .fetch_one(db)
        .await
}

pub async fn signup_binding(db: impl PgExecutor<'_>, id: Uuid) -> sqlx::Result<Option<Vec<u8>>> {
    sqlx::query_scalar!("SELECT signup_binding_hash FROM users WHERE id = $1", id)
        .fetch_one(db)
        .await
}

/// Verifies the address and forgets which browser signed up, which only mattered until now
pub async fn mark_verified(db: impl PgExecutor<'_>, id: Uuid) -> sqlx::Result<User> {
    sqlx::query_as!(
        User,
        "UPDATE users SET verified_at = COALESCE(verified_at, now()), signup_binding_hash = NULL, \
         updated_at = now() WHERE id = $1 RETURNING id, email, verified_at, created_at, updated_at",
        id
    )
    .fetch_one(db)
    .await
}

/// Also verifies the address: the reset link reached it, which is the proof verification asks for
pub async fn set_password(
    db: impl PgExecutor<'_>,
    id: Uuid,
    password_hash: &str,
) -> sqlx::Result<User> {
    sqlx::query_as!(
        User,
        "UPDATE users SET password = $2, verified_at = COALESCE(verified_at, now()), \
         signup_binding_hash = NULL, updated_at = now() \
         WHERE id = $1 RETURNING id, email, verified_at, created_at, updated_at",
        id,
        password_hash
    )
    .fetch_one(db)
    .await
}
