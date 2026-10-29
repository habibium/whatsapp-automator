use axum::http::StatusCode;
use serde_json::{Value, json};
use sqlx::PgPool;

use super::{PASSWORD, TestApp};
use crate::auth::{pwned::PwnedPasswords, token::Purpose};

const BREACHED: &str = "password123";
const APP_URL: &str = "http://localhost:5173";

fn breached_password_error() -> Value {
    json!(["appears in a known data breach; choose another"])
}

#[sqlx::test]
async fn signup_refuses_a_breached_password(pool: PgPool) {
    let app = TestApp::with_pwned_passwords(pool, APP_URL, PwnedPasswords::Listed(&[BREACHED]));

    let refused = app
        .post(
            "/signup",
            json!({ "email": "ada@example.com", "password": BREACHED }),
            None,
        )
        .await;
    assert_eq!(refused.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        refused.body["details"]["password"],
        breached_password_error()
    );

    app.signup("ada@example.com").await;
}

#[sqlx::test]
async fn reset_refuses_a_breached_password_and_keeps_the_link(pool: PgPool) {
    let app = TestApp::with_pwned_passwords(pool, APP_URL, PwnedPasswords::Listed(&[BREACHED]));
    let user_id = app.verified_user("ada@example.com").await;
    let token = app.link_token(user_id, Purpose::ResetPassword).await;

    let refused = app
        .post(
            "/reset-password",
            json!({ "token": token, "password": BREACHED }),
            None,
        )
        .await;
    assert_eq!(refused.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        refused.body["details"]["password"],
        breached_password_error()
    );
    assert_eq!(
        app.signin("ada@example.com", PASSWORD).await.status,
        StatusCode::OK
    );

    let reset = app
        .post(
            "/reset-password",
            json!({ "token": token, "password": "new battery staple" }),
            None,
        )
        .await;
    assert_eq!(reset.status, StatusCode::OK);
}

#[sqlx::test]
async fn an_unreachable_hibp_does_not_block_signup(pool: PgPool) {
    let app = TestApp::with_pwned_passwords(pool, APP_URL, PwnedPasswords::Unreachable);

    let response = app
        .post(
            "/signup",
            json!({ "email": "ada@example.com", "password": BREACHED }),
            None,
        )
        .await;
    assert_eq!(response.status, StatusCode::OK);
}
