use std::sync::Arc;

use axum::{
    Router,
    body::{Body, to_bytes},
    http::{HeaderMap, Request, StatusCode, header},
};
use serde_json::{Value, json};
use sqlx::PgPool;
use tokio::task::JoinSet;
use tower::ServiceExt;
use url::Url;
use uuid::Uuid;

use crate::{
    auth::{
        password, session,
        token::{Purpose, Token},
    },
    db,
    email::Mailer,
    state::AppState,
};

mod rate_limit;

const PASSWORD: &str = "correct horse";
const INVALID_LINK: &str = "This link is invalid or has expired";

#[derive(Clone)]
struct TestApp {
    router: Router,
    pool: PgPool,
}

struct TestResponse {
    status: StatusCode,
    headers: HeaderMap,
    body: Value,
}

impl TestResponse {
    /// The `Set-Cookie` header for cookie `name`, if the response set or cleared it
    fn set_cookie(&self, name: &str) -> Option<&str> {
        self.headers
            .get_all(header::SET_COOKIE)
            .iter()
            .map(|value| value.to_str().unwrap())
            .find(|value| value.starts_with(&format!("{name}=")))
    }

    /// The `name=value` pair to send back, as a browser would
    fn cookie(&self, name: &str) -> String {
        let set_cookie = self.set_cookie(name).expect("no such cookie set");
        set_cookie.split(';').next().unwrap().to_owned()
    }
}

impl TestApp {
    fn new(pool: PgPool) -> Self {
        Self::with_app_url(pool, "http://localhost:5173")
    }

    fn with_app_url(pool: PgPool, app_url: &str) -> Self {
        let state = AppState {
            pool: pool.clone(),
            mailer: Mailer::Log,
            app_url: Arc::new(Url::parse(app_url).unwrap()),
        };
        let (router, _) = crate::router();

        Self {
            router: router.with_state(state),
            pool,
        }
    }

    async fn post(&self, path: &str, body: Value, cookie: Option<&str>) -> TestResponse {
        let mut request = Request::post(format!("/api/auth{path}"))
            .header(header::CONTENT_TYPE, "application/json");
        if let Some(cookie) = cookie {
            request = request.header(header::COOKIE, cookie);
        }
        self.send(request.body(Body::from(body.to_string())).unwrap())
            .await
    }

    async fn session(&self, cookie: &str) -> TestResponse {
        let request = Request::get("/api/auth/session")
            .header(header::COOKIE, cookie)
            .body(Body::empty())
            .unwrap();
        self.send(request).await
    }

    async fn send(&self, request: Request<Body>) -> TestResponse {
        let response = self.router.clone().oneshot(request).await.unwrap();
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body = serde_json::from_slice(&bytes).unwrap_or(Value::Null);

        TestResponse {
            status,
            headers,
            body,
        }
    }

    async fn signup(&self, email: &str) -> TestResponse {
        let response = self
            .post(
                "/signup",
                json!({ "email": email, "password": PASSWORD }),
                None,
            )
            .await;
        assert_eq!(response.status, StatusCode::OK);
        response
    }

    async fn verified_user(&self, email: &str) -> Uuid {
        let password_hash = password::hash(PASSWORD.into()).await.unwrap();
        let binding = Token::generate().unwrap();
        let user = db::users::insert(&self.pool, email, &password_hash, &binding.hash)
            .await
            .unwrap();
        db::users::mark_verified(&self.pool, user.id).await.unwrap();
        user.id
    }

    async fn signin(&self, email: &str, password: &str) -> TestResponse {
        self.post(
            "/signin",
            json!({ "email": email, "password": password }),
            None,
        )
        .await
    }

    /// Stands in for the link in an email, which tests cannot read
    async fn link_token(&self, user_id: Uuid, purpose: Purpose) -> String {
        let token = Token::generate().unwrap();
        db::tokens::insert(&self.pool, &token.hash, user_id, purpose)
            .await
            .unwrap();
        token.value
    }

    /// Opens a fresh verification link for `user_id` in a browser holding `cookie`
    async fn verify(&self, user_id: Uuid, cookie: Option<&str>) -> TestResponse {
        let token = self.link_token(user_id, Purpose::VerifyEmail).await;
        self.post("/verify-email", json!({ "token": token }), cookie)
            .await
    }

    async fn count(&self, sql: &'static str, user_id: Uuid) -> i64 {
        sqlx::query_scalar(sql)
            .bind(user_id)
            .fetch_one(&self.pool)
            .await
            .unwrap()
    }
}

fn user_id(response: &TestResponse) -> Uuid {
    response.body["id"].as_str().unwrap().parse().unwrap()
}

#[sqlx::test]
async fn signup_creates_an_unverified_account_and_a_verification_link(pool: PgPool) {
    let app = TestApp::new(pool);

    let response = app.signup("Ada@Example.com").await;
    assert_eq!(response.body["email"], "ada@example.com");
    assert!(response.body["verified_at"].is_null());
    assert!(response.set_cookie("signup").is_some());

    let id = user_id(&response);
    let links = "SELECT count(*) FROM user_tokens WHERE user_id = $1 AND purpose = 'verify_email'";
    assert_eq!(app.count(links, id).await, 1);
    let bound = "SELECT count(*) FROM users WHERE id = $1 AND signup_binding_hash IS NOT NULL";
    assert_eq!(app.count(bound, id).await, 1);

    let again = app
        .post(
            "/signup",
            json!({ "email": "ada@example.com", "password": PASSWORD }),
            None,
        )
        .await;
    assert_eq!(again.status, StatusCode::CONFLICT);
}

#[sqlx::test]
async fn signup_refuses_addresses_the_mailer_cannot_send_to(pool: PgPool) {
    let app = TestApp::new(pool);

    let response = app
        .post(
            "/signup",
            json!({ "email": "a..b@example.com", "password": PASSWORD }),
            None,
        )
        .await;
    assert_eq!(response.status, StatusCode::BAD_REQUEST);
    assert!(response.body["details"]["email"].is_array());
}

#[sqlx::test]
async fn signin_needs_the_right_password_and_a_verified_address(pool: PgPool) {
    let app = TestApp::new(pool);
    let user_id = user_id(&app.signup("ada@example.com").await);

    let wrong = app.signin("ada@example.com", "wrong password").await;
    let unknown = app.signin("nobody@example.com", PASSWORD).await;
    assert_eq!(wrong.status, StatusCode::UNAUTHORIZED);
    assert_eq!(unknown.status, StatusCode::UNAUTHORIZED);
    assert_eq!(wrong.body, unknown.body);

    let unverified = app.signin("ada@example.com", PASSWORD).await;
    assert_eq!(unverified.status, StatusCode::FORBIDDEN);
    assert!(unverified.set_cookie("session").is_none());

    db::users::mark_verified(&app.pool, user_id).await.unwrap();
    let signed_in = app.signin("ADA@example.com", PASSWORD).await;
    assert_eq!(signed_in.status, StatusCode::OK);

    let session = app.session(&signed_in.cookie("session")).await;
    assert_eq!(session.body["user"]["email"], "ada@example.com");
    assert_eq!(session.headers[header::CACHE_CONTROL], "no-store");
}

#[sqlx::test]
async fn a_session_never_starts_for_a_password_that_was_replaced(pool: PgPool) {
    let app = TestApp::new(pool);
    let user_id = app.verified_user("ada@example.com").await;
    let old_hash: String = sqlx::query_scalar("SELECT password FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_one(&app.pool)
        .await
        .unwrap();
    let new_hash = password::hash("new battery staple".into()).await.unwrap();
    db::users::set_password(&app.pool, user_id, &new_hash)
        .await
        .unwrap();

    // What a sign-in that verified the old password just before a reset tries to do
    let token = Token::generate().unwrap();
    let started =
        db::sessions::insert_if_password(&app.pool, &token.hash, user_id, &old_hash, session::TTL)
            .await
            .unwrap();
    assert!(!started);
}

#[sqlx::test]
async fn verification_signs_in_only_the_browser_that_signed_up(pool: PgPool) {
    let app = TestApp::new(pool);
    let ada = user_id(&app.signup("ada@example.com").await);
    let grace = app.signup("grace@example.com").await;
    let grace_cookie = grace.cookie("signup");
    let linus = user_id(&app.signup("linus@example.com").await);

    // Opened anywhere else, for instance by a page that navigates its visitor to the link
    let elsewhere = app.verify(ada, None).await;
    assert_eq!(elsewhere.status, StatusCode::OK);
    assert!(elsewhere.body["user"]["verified_at"].is_string());
    assert_eq!(elsewhere.body["signed_in"], false);
    assert!(elsewhere.set_cookie("session").is_none());

    let other_signup = app.verify(linus, Some(&grace_cookie)).await;
    assert_eq!(other_signup.body["signed_in"], false);

    // A link sent again later works the same as the first one
    let same_browser = app.verify(user_id(&grace), Some(&grace_cookie)).await;
    assert_eq!(same_browser.body["signed_in"], true);
    assert!(
        same_browser
            .set_cookie("signup")
            .unwrap()
            .contains("Max-Age=0")
    );
    let session = app.session(&same_browser.cookie("session")).await;
    assert_eq!(session.body["user"]["email"], "grace@example.com");
}

#[sqlx::test]
async fn verification_links_work_once(pool: PgPool) {
    let app = TestApp::new(pool);
    let user_id = user_id(&app.signup("ada@example.com").await);
    let token = app.link_token(user_id, Purpose::VerifyEmail).await;

    let verified = app
        .post("/verify-email", json!({ "token": token }), None)
        .await;
    assert_eq!(verified.status, StatusCode::OK);

    // The link from signup is retired along with the one that was used
    let links = app
        .count(
            "SELECT count(*) FROM user_tokens WHERE user_id = $1",
            user_id,
        )
        .await;
    assert_eq!(links, 0);

    let reused = app
        .post("/verify-email", json!({ "token": token }), None)
        .await;
    assert_eq!(reused.status, StatusCode::BAD_REQUEST);
    assert_eq!(reused.body["error"], INVALID_LINK);
}

#[sqlx::test]
async fn links_only_work_for_their_purpose_and_before_they_expire(pool: PgPool) {
    let app = TestApp::new(pool);
    let user_id = user_id(&app.signup("ada@example.com").await);

    let reset = app.link_token(user_id, Purpose::ResetPassword).await;
    let misused = app
        .post("/verify-email", json!({ "token": reset }), None)
        .await;
    assert_eq!(misused.status, StatusCode::BAD_REQUEST);
    assert_eq!(misused.body["error"], INVALID_LINK);

    let still_valid = app
        .post(
            "/reset-password",
            json!({ "token": reset, "password": "new battery staple" }),
            None,
        )
        .await;
    assert_eq!(still_valid.status, StatusCode::OK);

    let verify = app.link_token(user_id, Purpose::VerifyEmail).await;
    sqlx::query("UPDATE user_tokens SET expires_at = now() - interval '1 second'")
        .execute(&app.pool)
        .await
        .unwrap();
    let expired = app
        .post("/verify-email", json!({ "token": verify }), None)
        .await;
    assert_eq!(expired.status, StatusCode::BAD_REQUEST);
    assert_eq!(expired.body["error"], INVALID_LINK);
}

#[sqlx::test]
async fn signout_ends_the_session_and_clears_the_cookie(pool: PgPool) {
    let app = TestApp::new(pool);
    app.verified_user("ada@example.com").await;
    let cookie = app
        .signin("ada@example.com", PASSWORD)
        .await
        .cookie("session");

    let signed_out = app.post("/signout", json!({}), Some(&cookie)).await;
    assert_eq!(signed_out.status, StatusCode::NO_CONTENT);
    assert!(
        signed_out
            .set_cookie("session")
            .unwrap()
            .contains("Max-Age=0")
    );

    let session = app.session(&cookie).await;
    assert!(session.body["user"].is_null());
    assert!(session.set_cookie("session").unwrap().contains("Max-Age=0"));
}

#[sqlx::test]
async fn session_expiry_slides_at_most_once_a_day(pool: PgPool) {
    let app = TestApp::new(pool);
    let user_id = app.verified_user("ada@example.com").await;
    let cookie = app
        .signin("ada@example.com", PASSWORD)
        .await
        .cookie("session");

    let fresh = app.session(&cookie).await;
    assert!(fresh.set_cookie("session").is_none());

    sqlx::query("UPDATE sessions SET expires_at = now() + interval '28 days' WHERE user_id = $1")
        .bind(user_id)
        .execute(&app.pool)
        .await
        .unwrap();
    let stale = app.session(&cookie).await;
    assert!(
        stale
            .set_cookie("session")
            .unwrap()
            .contains("Max-Age=2592000")
    );

    let extended = app
        .count(
            "SELECT count(*) FROM sessions WHERE user_id = $1 AND expires_at > now() + interval '29 days'",
            user_id,
        )
        .await;
    assert_eq!(extended, 1);
}

#[sqlx::test]
async fn forgot_password_answers_alike_for_unknown_addresses_and_throttles(pool: PgPool) {
    let app = TestApp::new(pool);
    let user_id = app.verified_user("ada@example.com").await;
    let resets =
        "SELECT count(*) FROM user_tokens WHERE user_id = $1 AND purpose = 'reset_password'";

    let unknown = app
        .post(
            "/forgot-password",
            json!({ "email": "nobody@example.com" }),
            None,
        )
        .await;
    assert_eq!(unknown.status, StatusCode::ACCEPTED);

    // At once, as a script trying to flood the inbox would send them
    let mut requests = JoinSet::new();
    for _ in 0..10 {
        let app = app.clone();
        requests.spawn(async move {
            app.post(
                "/forgot-password",
                json!({ "email": "ada@example.com" }),
                None,
            )
            .await
            .status
        });
    }
    while let Some(status) = requests.join_next().await {
        assert_eq!(status.unwrap(), StatusCode::ACCEPTED);
    }
    assert_eq!(app.count(resets, user_id).await, 1);
}

#[sqlx::test]
async fn resend_verification_mails_unverified_accounts_only(pool: PgPool) {
    let app = TestApp::new(pool);
    let unverified = user_id(&app.signup("ada@example.com").await);
    let verified = app.verified_user("grace@example.com").await;
    let links = "SELECT count(*) FROM user_tokens WHERE user_id = $1";

    // Past the one-minute pause that follows the signup email
    sqlx::query("UPDATE user_tokens SET created_at = now() - interval '2 minutes'")
        .execute(&app.pool)
        .await
        .unwrap();

    for email in ["ada@example.com", "grace@example.com"] {
        let response = app
            .post("/resend-verification", json!({ "email": email }), None)
            .await;
        assert_eq!(response.status, StatusCode::ACCEPTED);
    }
    assert_eq!(app.count(links, unverified).await, 2);
    assert_eq!(app.count(links, verified).await, 0);
}

#[sqlx::test]
async fn reset_password_replaces_the_password_and_ends_every_session(pool: PgPool) {
    let app = TestApp::new(pool);
    let user_id = app.verified_user("ada@example.com").await;
    let cookie = app
        .signin("ada@example.com", PASSWORD)
        .await
        .cookie("session");
    let token = app.link_token(user_id, Purpose::ResetPassword).await;

    let reset = app
        .post(
            "/reset-password",
            json!({ "token": token, "password": "new battery staple" }),
            None,
        )
        .await;
    assert_eq!(reset.status, StatusCode::OK);
    assert_eq!(reset.body["email"], "ada@example.com");

    assert!(app.session(&cookie).await.body["user"].is_null());
    assert_eq!(
        app.signin("ada@example.com", PASSWORD).await.status,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        app.signin("ada@example.com", "new battery staple")
            .await
            .status,
        StatusCode::OK
    );
}

#[sqlx::test]
async fn reset_password_verifies_the_address_and_retires_other_links(pool: PgPool) {
    let app = TestApp::new(pool);
    let user_id = user_id(&app.signup("ada@example.com").await);
    let verify = app.link_token(user_id, Purpose::VerifyEmail).await;
    let reset = app.link_token(user_id, Purpose::ResetPassword).await;

    app.post(
        "/reset-password",
        json!({ "token": reset, "password": "new battery staple" }),
        None,
    )
    .await;

    assert_eq!(
        app.signin("ada@example.com", "new battery staple")
            .await
            .status,
        StatusCode::OK
    );
    let outstanding = app
        .post("/verify-email", json!({ "token": verify }), None)
        .await;
    assert_eq!(outstanding.status, StatusCode::BAD_REQUEST);
}

#[sqlx::test]
async fn cross_site_writes_are_refused(pool: PgPool) {
    let app = TestApp::new(pool);
    let request = |site: &str| {
        Request::post("/api/auth/signout")
            .header("sec-fetch-site", site)
            .body(Body::empty())
            .unwrap()
    };

    assert_eq!(
        app.send(request("cross-site")).await.status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        app.send(request("same-site")).await.status,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        app.send(request("same-origin")).await.status,
        StatusCode::NO_CONTENT
    );
}

#[sqlx::test]
async fn https_deployments_get_secure_host_only_cookies(pool: PgPool) {
    let app = TestApp::with_app_url(pool, "https://wa.example.com");
    app.verified_user("ada@example.com").await;

    let signin = app.signin("ada@example.com", PASSWORD).await;
    let session = signin.set_cookie("__Host-session").unwrap();
    assert!(session.contains("; Secure"));
    assert!(session.contains("; HttpOnly"));

    let signup = app.signup("grace@example.com").await;
    assert!(
        signup
            .set_cookie("__Host-signup")
            .unwrap()
            .contains("; Secure")
    );
}
