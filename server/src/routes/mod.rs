pub mod auth;
pub mod health;

use crate::error::AppError;

pub async fn not_found() -> AppError {
    AppError::NotFound
}
