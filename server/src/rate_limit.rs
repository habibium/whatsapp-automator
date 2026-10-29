use std::{
    hash::Hash,
    net::{IpAddr, Ipv6Addr, SocketAddr},
    num::NonZeroU32,
    sync::Arc,
    time::Duration,
};

use axum::{
    body::Body,
    extract::ConnectInfo,
    http::{HeaderName, Method, Request, Response},
    response::IntoResponse,
};
use governor::{
    DefaultKeyedRateLimiter, Quota, RateLimiter, clock::Clock, middleware::NoOpMiddleware,
};
use tower_governor::{
    GovernorError, GovernorLayer, governor::GovernorConfigBuilder, key_extractor::KeyExtractor,
};
use uuid::Uuid;

use crate::error::AppError;

const SWEEP_EVERY: Duration = Duration::from_mins(10);
const ACCOUNT_BURST: NonZeroU32 = NonZeroU32::new(10).unwrap();
const ACCOUNT_REFILL: Duration = Duration::from_secs(90);

/// Limits writes per client IP to a burst of 20, then one every 6 seconds (10 a minute). Reads
/// pass untouched: route guards poll the session on every page load.
pub fn client_ip_layer() -> GovernorLayer<ClientIp, NoOpMiddleware, Body> {
    let config = GovernorConfigBuilder::default()
        .period(Duration::from_secs(6))
        .burst_size(20)
        .methods(vec![
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
        ])
        .key_extractor(ClientIp)
        .finish()
        .expect("period and burst size are nonzero");
    sweep(config.limiter());

    GovernorLayer::new(config).error_handler(too_many_requests)
}

fn too_many_requests(error: GovernorError) -> Response<Body> {
    match error {
        // governor truncates the wait to whole seconds
        GovernorError::TooManyRequests { wait_time, .. } => {
            AppError::TooManyRequests(Duration::from_secs(wait_time + 1)).into_response()
        }
        error => AppError::Internal(error.into()).into_response(),
    }
}

/// Names the header a trusted proxy sets to the client's address. Added as a request extension,
/// since the rate limit runs before handlers and cannot read `AppState`.
#[derive(Clone)]
pub struct ClientIpHeader(pub Option<HeaderName>);

/// The address in the [`ClientIpHeader`] when one is named and present, else the peer address
#[derive(Clone, Copy)]
pub struct ClientIp;

impl KeyExtractor for ClientIp {
    type Key = IpAddr;

    fn name(&self) -> &'static str {
        "client IP"
    }

    fn extract<T>(&self, request: &Request<T>) -> Result<Self::Key, GovernorError> {
        let extensions = request.extensions();
        let forwarded = extensions
            .get::<ClientIpHeader>()
            .and_then(|ClientIpHeader(name)| request.headers().get(name.as_ref()?))
            .and_then(|value| value.to_str().ok()?.trim().parse().ok());
        let peer = || {
            extensions
                .get::<ConnectInfo<SocketAddr>>()
                .map(|ConnectInfo(addr)| addr.ip())
        };

        // Only requests that skip `main`, as tests do, lack a peer address; they share one key
        Ok(forwarded
            .or_else(peer)
            .map_or(IpAddr::V6(Ipv6Addr::UNSPECIFIED), key))
    }

    fn key_name(&self, key: &Self::Key) -> Option<String> {
        Some(key.to_string())
    }
}

/// An IPv6 client usually holds a whole /64, so it counts as one client, or it could rotate
/// through addresses to dodge the limit
fn key(ip: IpAddr) -> IpAddr {
    match ip.to_canonical() {
        IpAddr::V6(ip) => IpAddr::V6(Ipv6Addr::from_bits(ip.to_bits() & !u128::from(u64::MAX))),
        ip @ IpAddr::V4(_) => ip,
    }
}

/// Attempts per account, however many addresses they come from: 10, then one every 90 seconds.
///
/// Anyone can spend an account's quota and so lock its owner out of password sign-in for up to 15
/// minutes, which is why it stays generous.
#[derive(Clone)]
pub struct RateLimits {
    signin: Arc<DefaultKeyedRateLimiter<String>>,
    reauth: Arc<DefaultKeyedRateLimiter<Uuid>>,
}

impl Default for RateLimits {
    /// Also starts sweeping the limiters in the background
    fn default() -> Self {
        let quota = Quota::with_period(ACCOUNT_REFILL)
            .expect("refill period is nonzero")
            .allow_burst(ACCOUNT_BURST);
        let limits = Self {
            signin: Arc::new(RateLimiter::keyed(quota)),
            reauth: Arc::new(RateLimiter::keyed(quota)),
        };
        sweep(&limits.signin);
        sweep(&limits.reauth);

        limits
    }
}

impl RateLimits {
    /// Counts a sign-in attempt for `email`, already normalized
    pub(crate) fn signin(&self, email: &str) -> Result<(), AppError> {
        check(&self.signin, &email.to_owned())
    }

    /// Counts a password re-check by the signed-in `user_id`
    pub(crate) fn reauth(&self, user_id: Uuid) -> Result<(), AppError> {
        check(&self.reauth, &user_id)
    }
}

fn check<K>(limiter: &DefaultKeyedRateLimiter<K>, key: &K) -> Result<(), AppError>
where
    K: Hash + Eq + Clone,
{
    limiter
        .check_key(key)
        .map_err(|refused| AppError::TooManyRequests(refused.wait_time_from(limiter.clock().now())))
}

/// Drops keys whose quota has refilled, which the limiter would treat as new anyway. Holds the
/// limiter weakly, so the sweep ends along with it.
fn sweep<K>(limiter: &Arc<DefaultKeyedRateLimiter<K>>)
where
    K: Hash + Eq + Clone + Send + Sync + 'static,
{
    // The openapi binary builds the router outside a runtime, and never serves it
    let Ok(runtime) = tokio::runtime::Handle::try_current() else {
        return;
    };
    let limiter = Arc::downgrade(limiter);
    runtime.spawn(async move {
        let mut interval = tokio::time::interval(SWEEP_EVERY);
        loop {
            interval.tick().await;
            let Some(limiter) = limiter.upgrade() else {
                break;
            };
            limiter.retain_recent();
            limiter.shrink_to_fit();
        }
    });
}
