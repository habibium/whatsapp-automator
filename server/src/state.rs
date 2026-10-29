use std::sync::Arc;

use sqlx::PgPool;
use url::Url;

use crate::{auth::pwned::PwnedPasswords, email::Mailer, rate_limit::RateLimits};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub mailer: Mailer,
    pub app_url: Arc<Url>,
    pub rate_limits: RateLimits,
    pub pwned_passwords: PwnedPasswords,
}

impl AppState {
    /// Browsers only send Secure cookies over https, so plain-http development goes without
    #[must_use]
    pub fn secure_cookies(&self) -> bool {
        self.app_url.scheme() == "https"
    }
}
