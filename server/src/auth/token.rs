use base64::prelude::{BASE64_URL_SAFE_NO_PAD, Engine as _};
use chrono::TimeDelta;
use sha2::{Digest, Sha256};

/// A secret the client holds (a session cookie, or the token in an emailed link). The database
/// stores only its hash.
pub struct Token {
    pub value: String,
    pub hash: [u8; 32],
}

impl Token {
    pub fn generate() -> anyhow::Result<Self> {
        let mut bytes = [0; 32];
        getrandom::fill(&mut bytes)?;
        let value = BASE64_URL_SAFE_NO_PAD.encode(bytes);

        Ok(Self {
            hash: hash(&value),
            value,
        })
    }
}

/// A fast hash is enough: 256 random bits cannot be brute-forced, unlike a password
pub fn hash(value: &str) -> [u8; 32] {
    Sha256::digest(value).into()
}

/// What an emailed link is for; a token issued for one purpose never works for the other
#[derive(Clone, Copy)]
pub enum Purpose {
    VerifyEmail,
    ResetPassword,
}

impl Purpose {
    /// Matches the `user_tokens.purpose` check constraint
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::VerifyEmail => "verify_email",
            Self::ResetPassword => "reset_password",
        }
    }

    pub const fn ttl(self) -> TimeDelta {
        match self {
            Self::VerifyEmail => TimeDelta::hours(24),
            Self::ResetPassword => TimeDelta::hours(1),
        }
    }
}
