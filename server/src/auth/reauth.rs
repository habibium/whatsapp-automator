use uuid::Uuid;

use super::password;
use crate::{db, error::AppError, state::AppState};

/// Asks for the password again before a change that would let someone holding only a stolen
/// session cookie keep access or lock the owner out, such as adding a passkey
#[expect(dead_code, reason = "two-step verification and passkeys call it")]
pub async fn confirm_password(
    state: &AppState,
    user_id: Uuid,
    password: String,
) -> Result<(), AppError> {
    // Otherwise someone holding a stolen session cookie could guess at the password unhindered
    state.rate_limits.reauth(user_id)?;
    let hash = db::users::password_hash(&state.pool, user_id).await?;
    if password::verify(password, Some(hash)).await? {
        Ok(())
    } else {
        Err(AppError::IncorrectPassword)
    }
}
