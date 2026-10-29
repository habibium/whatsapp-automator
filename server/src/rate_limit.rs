use std::{
    net::{IpAddr, Ipv6Addr, SocketAddr},
    time::Duration,
};

use axum::{
    body::Body,
    extract::ConnectInfo,
    http::{HeaderName, Method, Request, Response},
    response::IntoResponse,
};
use governor::middleware::NoOpMiddleware;
use tower_governor::{
    GovernorError, GovernorLayer, governor::GovernorConfigBuilder, key_extractor::KeyExtractor,
};

use crate::error::AppError;

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
