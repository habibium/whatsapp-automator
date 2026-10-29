use base64::prelude::{BASE64_STANDARD, Engine as _};
use qrcode::{QrCode, render::svg};
use sha2::{Digest, Sha256};
use totp_rs::{Algorithm, Builder, Totp};
use uuid::Uuid;
use zeroize::Zeroizing;

use crate::crypto::Cipher;

/// The label authenticator apps show next to the account's codes
const ISSUER: &str = "WhatsApp Automator";
const RECOVERY_CODE_COUNT: usize = 10;
/// Crockford's base32 alphabet, which leaves out I, L, O and U so no character reads as another
const RECOVERY_ALPHABET: &[u8; 32] = b"0123456789abcdefghjkmnpqrstvwxyz";

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

pub fn open(cipher: &Cipher, user_id: Uuid, sealed: &[u8]) -> anyhow::Result<Zeroizing<Vec<u8>>> {
    cipher.decrypt(sealed, &context(user_id))
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

/// The time step `code` belongs to, if it is current and newer than `last_used_step`. RFC 6238 lets
/// each code work once, so one from that step or an earlier one is refused as a replay.
pub fn verify_code(totp: &Totp, code: &str, last_used_step: Option<i64>) -> Option<i64> {
    let code: String = code.chars().filter(|c| !c.is_whitespace()).collect();
    let step = i64::try_from(totp.check_current(&code)?).ok()?;

    last_used_step
        .is_none_or(|last| step > last)
        .then_some(step)
}

/// 16 characters of 5 random bits each, written `xxxx-xxxx-xxxx-xxxx`
pub fn new_recovery_codes() -> anyhow::Result<Vec<String>> {
    (0..RECOVERY_CODE_COUNT)
        .map(|_| {
            let mut bytes = [0u8; 16];
            getrandom::fill(&mut bytes)?;
            // 256 is a multiple of 32, so masking leaves every character equally likely
            let chars: Vec<char> = bytes
                .iter()
                .map(|byte| char::from(RECOVERY_ALPHABET[usize::from(byte & 31)]))
                .collect();

            Ok(chars
                .chunks(4)
                .map(String::from_iter)
                .collect::<Vec<_>>()
                .join("-"))
        })
        .collect()
}

/// A fast hash is enough for 80 random bits; the user id keeps one table of guesses from covering
/// every account. Case, spaces, dashes and Crockford's look-alikes (O for 0, I and L for 1) do not
/// change the hash.
pub fn hash_recovery_code(user_id: Uuid, code: &str) -> [u8; 32] {
    let normalized: String = code
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .map(|c| match c.to_ascii_lowercase() {
            'o' => '0',
            'i' | 'l' => '1',
            c => c,
        })
        .collect();

    Sha256::new()
        .chain_update(user_id.as_bytes())
        .chain_update(normalized)
        .finalize()
        .into()
}

#[cfg(test)]
mod tests {
    use uuid::Uuid;

    use super::{
        hash_recovery_code, new_recovery_codes, new_secret, open, qr_code, seal, totp, verify_code,
    };
    use crate::crypto::Cipher;

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

    #[test]
    fn a_sealed_key_opens_for_its_owner_only() {
        let cipher = Cipher::new(&[1; 32]);
        let (ada, grace) = (Uuid::new_v4(), Uuid::new_v4());
        let sealed = seal(&cipher, ada, b"key").unwrap();

        assert_eq!(open(&cipher, ada, &sealed).unwrap().as_slice(), b"key");
        assert!(open(&cipher, grace, &sealed).is_err());
    }

    #[test]
    fn a_code_works_once_and_only_while_current() {
        let secret = new_secret().unwrap();
        let totp = totp(secret.as_slice(), "ada@example.com").unwrap();
        let code = totp.generate_current().to_string();

        let step = verify_code(&totp, &code, None).unwrap();
        assert_eq!(verify_code(&totp, &format!(" {code} "), None), Some(step));
        assert_eq!(verify_code(&totp, &code, Some(step)), None);
        assert_eq!(verify_code(&totp, &code, Some(step - 1)), Some(step));

        let stale = totp.generate(totp.next_step_current() - 3 * 30).to_string();
        assert_eq!(verify_code(&totp, &stale, None), None);
        assert_eq!(verify_code(&totp, "12345", None), None);
    }

    #[test]
    fn recovery_codes_are_distinct_and_survive_retyping() {
        let user_id = Uuid::new_v4();
        let codes = new_recovery_codes().unwrap();

        assert_eq!(codes.len(), 10);
        assert!(
            codes
                .iter()
                .all(|code| code.len() == 19 && code.split('-').all(|group| group.len() == 4))
        );
        let mut unique = codes;
        unique.sort();
        unique.dedup();
        assert_eq!(unique.len(), 10);

        let code = "0il1-abcd-efgh-jkmn";
        let hash = hash_recovery_code(user_id, code);
        assert_eq!(hash_recovery_code(user_id, " OIL1 ABCD-efgh jkmn "), hash);
        assert_ne!(hash_recovery_code(user_id, "0il1-abcd-efgh-jkmp"), hash);
        assert_ne!(hash_recovery_code(Uuid::new_v4(), code), hash);
    }
}
