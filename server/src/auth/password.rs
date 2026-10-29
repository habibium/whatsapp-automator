use std::{num::NonZeroUsize, sync::LazyLock, thread};

use argon2::{
    Argon2,
    password_hash::{self, PasswordHasher, PasswordVerifier, phc::PasswordHash},
};
use tokio::sync::Semaphore;

/// Each Argon2 run holds about 19 MiB. Without a cap, a burst of sign-ins (unknown emails
/// included, see `DECOY_HASH`) can exhaust memory; one run per core keeps the peak fixed and
/// queues the rest.
static SLOTS: LazyLock<Semaphore> =
    LazyLock::new(|| Semaphore::new(thread::available_parallelism().map_or(1, NonZeroUsize::get)));

/// Checked when no account matches, so an unknown email costs as much time as a wrong password
static DECOY_HASH: LazyLock<String> = LazyLock::new(|| {
    Argon2::default()
        .hash_password(b"decoy")
        .expect("hashing a constant with default params cannot fail")
        .to_string()
});

pub async fn hash(password: String) -> anyhow::Result<String> {
    run(move || {
        let argon2 = Argon2::default();
        let hash = argon2.hash_password(password.as_bytes())?;

        Ok(hash.to_string())
    })
    .await
}

/// `stored_hash` is `None` when the account does not exist; that never verifies, but takes as
/// long as a real check.
pub async fn verify(password: String, stored_hash: Option<String>) -> anyhow::Result<bool> {
    run(move || {
        let hash = PasswordHash::new(stored_hash.as_deref().unwrap_or(&DECOY_HASH))?;

        match Argon2::default().verify_password(password.as_bytes(), &hash) {
            Ok(()) => Ok(stored_hash.is_some()),
            Err(password_hash::Error::PasswordInvalid) => Ok(false),
            Err(e) => Err(e.into()),
        }
    })
    .await
}

async fn run<T: Send + 'static>(
    work: impl FnOnce() -> anyhow::Result<T> + Send + 'static,
) -> anyhow::Result<T> {
    let _slot = SLOTS.acquire().await?;
    tokio::task::spawn_blocking(work).await?
}
