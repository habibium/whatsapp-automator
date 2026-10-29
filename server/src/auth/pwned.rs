use std::{sync::Arc, time::Duration};

use rustls::{ClientConfig, RootCertStore};
use sha1::{Digest, Sha1};
use validator::{ValidationError, ValidationErrors};

use crate::error::AppError;

const RANGE_URL: &str = "https://api.pwnedpasswords.com/range/";
/// Past this, the check is skipped rather than holding up the sign-up any longer
const TIMEOUT: Duration = Duration::from_secs(3);

/// Have I Been Pwned's Pwned Passwords, asked with k-anonymity: only the first 5 hex characters of
/// a password's SHA-1 leave the server
#[derive(Clone)]
pub enum PwnedPasswords {
    Hibp(reqwest::Client),
    /// Lists these passwords as breached, and no others, without the network
    #[cfg(test)]
    Listed(&'static [&'static str]),
    /// Fails every lookup, as HIBP does when slow or unreachable
    #[cfg(test)]
    Unreachable,
}

impl PwnedPasswords {
    /// # Errors
    /// The HTTP client cannot be built.
    pub fn hibp() -> anyhow::Result<Self> {
        // ring and webpki-roots, as lettre uses: no second crypto library, no reliance on OS roots
        let tls =
            ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
                .with_safe_default_protocol_versions()?
                .with_root_certificates(RootCertStore {
                    roots: webpki_roots::TLS_SERVER_ROOTS.to_vec(),
                })
                .with_no_client_auth();
        let client = reqwest::Client::builder()
            .tls_backend_preconfigured(tls)
            .user_agent(concat!("whatsapp-automator/", env!("CARGO_PKG_VERSION")))
            .timeout(TIMEOUT)
            .build()?;

        Ok(Self::Hibp(client))
    }

    /// Refuses a password HIBP lists, as a validation error on `field`. Fails open: while HIBP is
    /// slow or unreachable, every password passes and a warning is logged.
    pub(crate) async fn reject_breached(
        &self,
        field: &'static str,
        password: &str,
    ) -> Result<(), AppError> {
        match self.is_breached(password).await {
            Ok(false) => Ok(()),
            Ok(true) => {
                let mut errors = ValidationErrors::new();
                errors.add(
                    field,
                    ValidationError::new("breached")
                        .with_message("appears in a known data breach; choose another".into()),
                );
                Err(errors.into())
            }
            Err(error) => {
                tracing::warn!(?error, "skipped the breached-password check");
                Ok(())
            }
        }
    }

    async fn is_breached(&self, password: &str) -> anyhow::Result<bool> {
        let hash = sha1_hex(password);
        let (prefix, suffix) = hash.split_at(5);
        let range = self.range(prefix).await?;

        Ok(lists(&range, suffix))
    }

    /// Every suffix HIBP knows for `prefix`, one `SUFFIX:COUNT` per line
    async fn range(&self, prefix: &str) -> anyhow::Result<String> {
        match self {
            Self::Hibp(client) => {
                let range = async {
                    client
                        .get(format!("{RANGE_URL}{prefix}"))
                        // Pads every answer to 800-1,000 lines, so its size does not hint at the prefix
                        .header("Add-Padding", "true")
                        .send()
                        .await?
                        .error_for_status()?
                        .text()
                        .await
                }
                .await;
                // The URL carries the prefix, which has no business in the log
                Ok(range.map_err(reqwest::Error::without_url)?)
            }
            #[cfg(test)]
            Self::Listed(passwords) => {
                let mut range: String = passwords
                    .iter()
                    .map(|password| sha1_hex(password))
                    .filter_map(|hash| Some(format!("{}:7\r\n", hash.strip_prefix(prefix)?)))
                    .collect();
                range.push_str("0000000000000000000000000000000000A:0\r\n");
                Ok(range)
            }
            #[cfg(test)]
            Self::Unreachable => anyhow::bail!("HIBP did not answer"),
        }
    }
}

fn sha1_hex(password: &str) -> String {
    const DIGITS: &[u8; 16] = b"0123456789ABCDEF";
    Sha1::digest(password)
        .iter()
        .flat_map(|byte| {
            [
                DIGITS[usize::from(byte >> 4)],
                DIGITS[usize::from(byte & 0xf)],
            ]
        })
        .map(char::from)
        .collect()
}

/// Padding lines have a count of 0, and do not mean the password is listed
fn lists(range: &str, suffix: &str) -> bool {
    range
        .lines()
        .filter_map(|line| line.split_once(':'))
        .any(|(candidate, count)| {
            candidate.eq_ignore_ascii_case(suffix) && count.trim().parse().is_ok_and(|n: u64| n > 0)
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_hash_prefix_is_sent_and_the_suffix_is_matched() {
        let hash = sha1_hex("password");
        assert_eq!(
            hash.split_at(5),
            ("5BAA6", "1E4C9B93F3F0682250B6CF8331B7EE68FD8")
        );

        let range = "003D68EB55068C33ACE09247EE4C639306B:3\r\n1e4c9b93f3f0682250b6cf8331b7ee68fd8:52256179\r\n";
        assert!(lists(range, "1E4C9B93F3F0682250B6CF8331B7EE68FD8"));
        assert!(!lists(range, "1E4C9B93F3F0682250B6CF8331B7EE68FD9"));
    }

    #[test]
    fn padding_lines_do_not_count() {
        let range = "1E4C9B93F3F0682250B6CF8331B7EE68FD8:0\r\n";
        assert!(!lists(range, "1E4C9B93F3F0682250B6CF8331B7EE68FD8"));
    }

    #[tokio::test]
    async fn listed_passwords_are_refused_on_the_named_field() {
        let pwned = PwnedPasswords::Listed(&["password123"]);
        assert!(
            pwned
                .reject_breached("password", "a fresh passphrase")
                .await
                .is_ok()
        );

        let Err(AppError::Validation(errors)) =
            pwned.reject_breached("new_password", "password123").await
        else {
            panic!("a listed password passed");
        };
        let messages = &errors.field_errors()["new_password"];
        assert_eq!(
            messages[0].message.as_deref(),
            Some("appears in a known data breach; choose another")
        );
    }

    #[tokio::test]
    async fn an_unreachable_hibp_lets_every_password_through() {
        let pwned = PwnedPasswords::Unreachable;
        assert!(
            pwned
                .reject_breached("password", "password123")
                .await
                .is_ok()
        );
    }
}
