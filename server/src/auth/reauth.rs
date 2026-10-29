use sqlx::PgPool;
use uuid::Uuid;

use super::password;
use crate::{db, error::AppError};

/// Asks for the password again before a change that would let someone holding only a stolen
/// session cookie keep access or lock the owner out, such as adding a passkey
#[expect(dead_code, reason = "two-step verification and passkeys call it")]
pub async fn confirm_password(
    db: &PgPool,
    user_id: Uuid,
    password: String,
) -> Result<(), AppError> {
    let hash = db::users::password_hash(db, user_id).await?;
    if password::verify(password, Some(hash)).await? {
        Ok(())
    } else {
        Err(AppError::IncorrectPassword)
    }
}
