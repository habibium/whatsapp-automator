use argon2::{Argon2, PasswordHasher};

pub async fn hash(password: String) -> anyhow::Result<String> {
    tokio::task::spawn_blocking(move || {
        let argon2 = Argon2::default();
        let hash = argon2.hash_password(password.as_bytes())?;

        Ok(hash.to_string())
    })
    .await?
}
