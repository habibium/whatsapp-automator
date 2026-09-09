use argon2::PasswordHasher;

pub async fn hash_password(password: String) -> anyhow::Result<String> {
    tokio::task::spawn_blocking(move || {
        let argon2 = argon2::Argon2::default();
        Ok(argon2.hash_password(password)?.to_string())
    })
}
