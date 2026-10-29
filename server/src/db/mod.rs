pub mod passkey_ceremonies;
pub mod passkeys;
pub mod sessions;
pub mod tokens;
pub mod two_factor;
pub mod users;

use std::time::Duration;

use sqlx::PgPool;

/// Hourly sweep of expired sessions, email links, passkey ceremonies and second-factor challenges.
/// Queries already ignore expired rows; this only keeps the tables from growing.
pub fn spawn_cleanup(pool: PgPool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_hours(1));
        loop {
            interval.tick().await;
            match tokio::try_join!(
                sessions::delete_expired(&pool),
                tokens::delete_expired(&pool),
                passkey_ceremonies::delete_expired(&pool),
                two_factor::delete_expired_challenges(&pool)
            ) {
                Ok((sessions, tokens, ceremonies, challenges)) => {
                    tracing::debug!(
                        sessions,
                        tokens,
                        ceremonies,
                        challenges,
                        "deleted expired sessions, tokens, passkey ceremonies and challenges"
                    );
                }
                Err(error) => {
                    tracing::warn!(?error, "failed to delete expired sessions and tokens");
                }
            }
        }
    });
}
