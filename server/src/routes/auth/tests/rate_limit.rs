use std::net::{IpAddr, SocketAddr};

use axum::{
    Extension,
    body::Body,
    extract::ConnectInfo,
    http::{HeaderName, Request, StatusCode, header},
};
use serde_json::json;
use sqlx::PgPool;

use super::{PASSWORD, TestApp, TestResponse};
use crate::rate_limit::ClientIpHeader;

/// Writes a client may make at once before the limit refuses one
const BURST: usize = 20;
const TOO_MANY: &str = "Too many attempts, try again later";

/// As `axum::serve` sees a request arriving from `peer`
fn from_peer(mut request: Request<Body>, peer: &str) -> Request<Body> {
    let peer: IpAddr = peer.parse().unwrap();
    request
        .extensions_mut()
        .insert(ConnectInfo(SocketAddr::new(peer, 40_000)));
    request
}

/// A write that touches no database, sent from `peer` with `headers` added
async fn signout(app: &TestApp, peer: &str, headers: &[(&str, &str)]) -> TestResponse {
    let mut request = Request::post("/api/auth/signout");
    for (name, value) in headers {
        request = request.header(*name, *value);
    }
    app.send(from_peer(request.body(Body::empty()).unwrap(), peer))
        .await
}

async fn signin(app: &TestApp, peer: &str, email: &str, password: &str) -> TestResponse {
    let request = Request::post("/api/auth/signin")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "email": email, "password": password }).to_string(),
        ))
        .unwrap();
    app.send(from_peer(request, peer)).await
}

fn retry_after(response: &TestResponse) -> u64 {
    response.headers[header::RETRY_AFTER]
        .to_str()
        .unwrap()
        .parse()
        .unwrap()
}

#[sqlx::test]
async fn auth_writes_beyond_the_burst_get_429_with_retry_after(pool: PgPool) {
    let app = TestApp::new(pool);

    for _ in 0..BURST {
        let response = signout(&app, "198.51.100.7", &[]).await;
        assert_eq!(response.status, StatusCode::NO_CONTENT);
    }

    let refused = signout(&app, "198.51.100.7", &[]).await;
    assert_eq!(refused.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(refused.body["error"], TOO_MANY);
    // One write comes back every 6 seconds
    assert!((1..=6).contains(&retry_after(&refused)));

    let other_client = signout(&app, "198.51.100.8", &[]).await;
    assert_eq!(other_client.status, StatusCode::NO_CONTENT);
}

#[sqlx::test]
async fn reading_the_session_is_not_limited(pool: PgPool) {
    let app = TestApp::new(pool);
    for _ in 0..=BURST {
        signout(&app, "198.51.100.7", &[]).await;
    }

    for _ in 0..BURST * 2 {
        let request = Request::get("/api/auth/session")
            .body(Body::empty())
            .unwrap();
        let response = app.send(from_peer(request, "198.51.100.7")).await;
        assert_eq!(response.status, StatusCode::OK);
    }
}

#[sqlx::test]
async fn behind_a_proxy_the_limit_keys_on_the_client_ip_header(pool: PgPool) {
    let app = TestApp::new(pool);
    let header = HeaderName::from_static("cf-connecting-ip");
    let app = TestApp {
        router: app.router.layer(Extension(ClientIpHeader(Some(header)))),
        ..app
    };
    let proxy = "10.0.0.2";

    for _ in 0..BURST {
        let response = signout(&app, proxy, &[("cf-connecting-ip", "203.0.113.9")]).await;
        assert_eq!(response.status, StatusCode::NO_CONTENT);
    }
    let refused = signout(&app, proxy, &[("cf-connecting-ip", "203.0.113.9")]).await;
    assert_eq!(refused.status, StatusCode::TOO_MANY_REQUESTS);

    // The same proxy forwards other clients, and they are not held back
    let other_client = signout(&app, proxy, &[("cf-connecting-ip", "203.0.113.10")]).await;
    assert_eq!(other_client.status, StatusCode::NO_CONTENT);

    // X-Forwarded-For is whatever the client wrote, so it changes nothing
    let spoofed = signout(
        &app,
        proxy,
        &[
            ("cf-connecting-ip", "203.0.113.9"),
            ("x-forwarded-for", "192.0.2.1"),
        ],
    )
    .await;
    assert_eq!(spoofed.status, StatusCode::TOO_MANY_REQUESTS);

    // Without the header, as for a request that reached the proxy directly, the peer counts
    let direct = signout(&app, proxy, &[]).await;
    assert_eq!(direct.status, StatusCode::NO_CONTENT);
}

#[sqlx::test]
async fn ipv6_clients_share_a_limit_across_their_64(pool: PgPool) {
    let app = TestApp::new(pool);

    for host in 1..=BURST {
        let response = signout(&app, &format!("2001:db8:1:2::{host:x}"), &[]).await;
        assert_eq!(response.status, StatusCode::NO_CONTENT);
    }

    let same_64 = signout(&app, "2001:db8:1:2:ffff::1", &[]).await;
    assert_eq!(same_64.status, StatusCode::TOO_MANY_REQUESTS);
    let next_64 = signout(&app, "2001:db8:1:3::1", &[]).await;
    assert_eq!(next_64.status, StatusCode::NO_CONTENT);
}

#[sqlx::test]
async fn sign_in_attempts_are_limited_per_account_from_any_address(pool: PgPool) {
    let app = TestApp::new(pool);
    app.verified_user("ada@example.com").await;
    app.verified_user("grace@example.com").await;

    // Each from its own address, as a botnet would send them, so no IP limit is reached
    for n in 1..=10 {
        let peer = format!("198.51.100.{n}");
        let guess = signin(&app, &peer, "Ada@example.com", "wrong password").await;
        assert_eq!(guess.status, StatusCode::UNAUTHORIZED);
    }

    let refused = signin(&app, "198.51.100.11", "ada@example.com", PASSWORD).await;
    assert_eq!(refused.status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(refused.body["error"], TOO_MANY);
    // One attempt comes back every 90 seconds
    assert!((1..=90).contains(&retry_after(&refused)));
    assert!(refused.set_cookie("session").is_none());

    let other_account = signin(&app, "198.51.100.11", "grace@example.com", PASSWORD).await;
    assert_eq!(other_account.status, StatusCode::OK);
}
