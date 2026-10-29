use base64::prelude::{BASE64_STANDARD, Engine as _};
use qrcode::{QrCode, render::svg};
use totp_rs::{Algorithm, Builder, Totp};
use uuid::Uuid;
use zeroize::Zeroizing;

use crate::crypto::Cipher;

/// The label authenticator apps show next to the account's codes
const ISSUER: &str = "WhatsApp Automator";

/// 160 bits, the length RFC 4226 recommends
pub fn new_secret() -> anyhow::Result<Zeroizing<[u8; 20]>> {
    let mut secret = Zeroizing::new([0; 20]);
    getrandom::fill(secret.as_mut())?;

    Ok(secret)
}

/// SHA-1, 6 digits and 30-second steps, the one combination every authenticator app supports.
/// A step of skew either way absorbs a phone clock that runs a little fast or slow.
pub fn totp(secret: &[u8], email: &str) -> anyhow::Result<Totp> {
    let totp = Builder::new()
        .with_algorithm(Algorithm::SHA1)
        .with_digits(6)
        .with_step_duration(30)
        .with_skew(1)
        .with_secret(secret)
        .with_account_name(email)
        .with_issuer(Some(ISSUER))
        .build()?;

    Ok(totp)
}

/// The owner's id goes into the seal, so a key copied into another account's row fails to open
pub fn seal(cipher: &Cipher, user_id: Uuid, secret: &[u8]) -> anyhow::Result<Vec<u8>> {
    cipher.encrypt(secret, &context(user_id))
}

fn context(user_id: Uuid) -> Vec<u8> {
    [b"totp:".as_slice(), user_id.as_bytes()].concat()
}

/// The otpauth URL as an SVG `data:` URL. Drawn here, so the key never reaches a QR service.
pub fn qr_code(otpauth_url: &str) -> anyhow::Result<String> {
    let svg = QrCode::new(otpauth_url)?
        .render::<svg::Color>()
        .min_dimensions(240, 240)
        .build();

    Ok(format!(
        "data:image/svg+xml;base64,{}",
        BASE64_STANDARD.encode(svg)
    ))
}

#[cfg(test)]
mod tests {
    use super::{new_secret, qr_code, totp};

    #[test]
    fn otpauth_url_names_the_issuer_and_account() {
        let secret = new_secret().unwrap();
        let url = totp(secret.as_slice(), "ada@example.com")
            .unwrap()
            .to_url()
            .unwrap();

        assert!(url.starts_with("otpauth://totp/WhatsApp%20Automator:ada%40example.com?secret="));
        assert!(url.ends_with("&issuer=WhatsApp%20Automator"));
        assert!(
            qr_code(&url)
                .unwrap()
                .starts_with("data:image/svg+xml;base64,")
        );
    }
}
