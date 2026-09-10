use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub verified_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub async fn insert(pool: &PgPool, email: String, password_hash: String) -> sqlx::Result<User> {
    sqlx::query_as!(
        User,
        "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email, verified_at, created_at, updated_at",
        email,
        password_hash
    )
    .fetch_one(pool)
    .await
}
