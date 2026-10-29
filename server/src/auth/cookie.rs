use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use chrono::TimeDelta;

use super::{passkey, session, token::Purpose, two_factor};

/// An `HttpOnly`, `SameSite=Lax` cookie on `/`. Over https it is also `Secure` and takes the
/// `__Host-` prefix, so no other subdomain can plant one; plain-http development cannot meet that
/// and uses the bare name.
pub struct AuthCookie {
    name: &'static str,
    secure_name: &'static str,
    max_age: TimeDelta,
}

pub const SESSION: AuthCookie = AuthCookie {
    name: "session",
    secure_name: "__Host-session",
    max_age: session::TTL,
};

/// Marks the browser that signed up, so the verification link signs in that browser and no other
pub const SIGNUP: AuthCookie = AuthCookie {
    name: "signup",
    secure_name: "__Host-signup",
    max_age: Purpose::VerifyEmail.ttl(),
};

/// Names the passkey registration or sign-in this browser has under way
pub const PASSKEY_CEREMONY: AuthCookie = AuthCookie {
    name: "passkey_ceremony",
    secure_name: "__Host-passkey_ceremony",
    max_age: passkey::TTL,
};

/// Carries a sign-in whose password checked out over to its second factor
pub const TWO_FACTOR: AuthCookie = AuthCookie {
    name: "two_factor",
    secure_name: "__Host-two_factor",
    max_age: two_factor::CHALLENGE_TTL,
};

impl AuthCookie {
    pub fn read<'a>(&self, jar: &'a CookieJar, secure: bool) -> Option<&'a str> {
        jar.get(self.name(secure)).map(Cookie::value)
    }

    pub fn set(&self, jar: CookieJar, value: String, secure: bool) -> CookieJar {
        jar.add(self.build(value, secure))
    }

    /// Tells the browser to drop the cookie; a no-op when the request did not send it
    pub fn clear(&self, jar: CookieJar, secure: bool) -> CookieJar {
        // Removal only takes when the attributes match the cookie being replaced
        jar.remove(self.build(String::new(), secure))
    }

    fn build(&self, value: String, secure: bool) -> Cookie<'static> {
        Cookie::build((self.name(secure), value))
            .path("/")
            .http_only(true)
            .secure(secure)
            .same_site(SameSite::Lax)
            .max_age(time::Duration::seconds(self.max_age.num_seconds()))
            .build()
    }

    const fn name(&self, secure: bool) -> &'static str {
        if secure { self.secure_name } else { self.name }
    }
}
