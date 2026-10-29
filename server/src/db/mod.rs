pub mod sessions;
pub mod tokens;
pub mod two_factor;
pub mod users;

use std::time::Duration;

use sqlx::PgPool;

/// Hourly sweep of expired sessions and email links. Queries already ignore expired rows; this
/// only keeps the tables from growing.
pub fn spawn_cleanup(pool: PgPool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_hours(1));
        loop {
            interval.tick().await;
            match tokio::try_join!(
                sessions::delete_expired(&pool),
                tokens::delete_expired(&pool)
            ) {
                Ok((sessions, tokens)) => {
                    tracing::debug!(sessions, tokens, "deleted expired sessions and tokens");
                }
                Err(error) => {
                    tracing::warn!(?error, "failed to delete expired sessions and tokens");
                }
            }
        }
    });
}
