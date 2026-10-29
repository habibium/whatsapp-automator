use std::sync::Arc;

use sqlx::PgPool;
use url::Url;

use crate::{crypto::Cipher, email::Mailer};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub mailer: Mailer,
    pub app_url: Arc<Url>,
    pub cipher: Cipher,
}

impl AppState {
    /// Browsers only send Secure cookies over https, so plain-http development goes without
    #[must_use]
    pub fn secure_cookies(&self) -> bool {
        self.app_url.scheme() == "https"
    }
}
