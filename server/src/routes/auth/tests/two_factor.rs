use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use serde_json::json;
use sqlx::PgPool;
use totp_rs::{Secret, Totp};
use uuid::Uuid;

use super::{PASSWORD, TestApp, TestResponse};
use crate::auth::{
    password,
    token::{self, Purpose, Token},
    two_factor,
};

const EMAIL: &str = "ada@example.com";

/// An account with two-step verification on, as its owner's browser and phone hold it
struct Enrolled {
    user_id: Uuid,
    totp: Totp,
    /// The step of the code that turned it on; a sign-in can use the next one, and the server
    /// accepts that one until two steps from now
    step: u64,
    recovery_codes: Vec<String>,
    session: String,
}

fn current_step() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        / 30
}

fn code(totp: &Totp, step: u64) -> String {
    totp.generate(step * 30).to_string()
}

/// A code that matches none of the steps the server could accept during the test
fn wrong_code(totp: &Totp) -> String {
    let now = current_step();
    let valid: Vec<String> = (now - 2..=now + 2).map(|step| code(totp, step)).collect();
    (0..10)
        .map(|digit| digit.to_string().repeat(6))
        .find(|candidate| !valid.contains(candidate))
        .unwrap()
}

impl TestApp {
    async fn get(&self, path: &str, cookie: &str) -> TestResponse {
        let request = Request::get(format!("/api/auth{path}"))
            .header(header::COOKIE, cookie)
            .body(Body::empty())
            .unwrap();
        self.send(request).await
    }

    /// Starts the setup and reads the key into an authenticator app
    async fn set_up(&self, session: &str) -> Totp {
        let setup = self
            .post(
                "/two-factor/setup",
                json!({ "password": PASSWORD }),
                Some(session),
            )
            .await;
        assert_eq!(setup.status, StatusCode::OK);
        let secret = Secret::try_from_base32(setup.body["secret"].as_str().unwrap()).unwrap();
        two_factor::totp(secret.as_bytes(), EMAIL).unwrap()
    }

    async fn enroll(&self, email: &str) -> Enrolled {
        let (user_id, session) = self.signed_in(email).await;
        let totp = self.set_up(&session).await;
        let step = current_step();
        let enabled = self
            .post(
                "/two-factor/enable",
                json!({ "code": code(&totp, step) }),
                Some(&session),
            )
            .await;
        assert_eq!(enabled.status, StatusCode::OK);
        let recovery_codes = enabled.body["recovery_codes"]
            .as_array()
            .unwrap()
            .iter()
            .map(|code| code.as_str().unwrap().to_owned())
            .collect();

        Enrolled {
            user_id,
            totp,
            step,
            recovery_codes,
            session: enabled.cookie("session"),
        }
    }

    /// Passes the password step and returns the cookie that carries the sign-in onward
    async fn challenge(&self, email: &str) -> String {
        let signin = self.signin(email, PASSWORD).await;
        assert_eq!(signin.body, json!({ "status": "two_factor_required" }));
        signin.cookie("two_factor")
    }

    async fn second_factor(&self, body: serde_json::Value, challenge: &str) -> TestResponse {
        self.post("/signin/two-factor", body, Some(challenge)).await
    }
}

#[sqlx::test]
async fn turning_on_takes_the_password_then_a_code_from_the_app(pool: PgPool) {
    let app = TestApp::new(pool);
    let (user_id, session) = app.signed_in(EMAIL).await;

    let off = app.get("/two-factor", &session).await;
    assert_eq!(
        off.body,
        json!({ "enabled": false, "recovery_codes_remaining": 0 })
    );
    assert_eq!(off.headers[header::CACHE_CONTROL], "no-store");

    let wrong_password = app
        .post(
            "/two-factor/setup",
            json!({ "password": "wrong password" }),
            Some(&session),
        )
        .await;
    assert_eq!(wrong_password.status, StatusCode::BAD_REQUEST);
    assert!(wrong_password.body["details"]["password"].is_array());

    let setup = app
        .post(
            "/two-factor/setup",
            json!({ "password": PASSWORD }),
            Some(&session),
        )
        .await;
    assert_eq!(setup.status, StatusCode::OK);
    assert_eq!(setup.headers[header::CACHE_CONTROL], "no-store");
    let url = setup.body["otpauth_url"].as_str().unwrap();
    let secret = setup.body["secret"].as_str().unwrap();
    assert_eq!(
        url,
        format!(
            "otpauth://totp/WhatsApp%20Automator:ada%40example.com?secret={secret}&issuer=WhatsApp%20Automator"
        )
    );
    assert!(
        setup.body["qr_code"]
            .as_str()
            .unwrap()
            .starts_with("data:image/svg+xml;base64,")
    );

    // Starting over replaces the key that was never confirmed
    let totp = app.set_up(&session).await;
    let sealed: Vec<u8> = sqlx::query_scalar("SELECT secret FROM totp_secrets WHERE user_id = $1")
        .bind(user_id)
        .fetch_one(&app.pool)
        .await
        .unwrap();
    assert!(
        !sealed
            .windows(20)
            .any(|window| window == totp.secret().as_bytes())
    );
    assert_eq!(
        app.get("/two-factor", &session).await.body["enabled"],
        false
    );

    let wrong_code = app
        .post(
            "/two-factor/enable",
            json!({ "code": wrong_code(&totp) }),
            Some(&session),
        )
        .await;
    assert_eq!(wrong_code.status, StatusCode::BAD_REQUEST);
    assert!(wrong_code.body["details"]["code"].is_array());

    let enabled = app
        .post(
            "/two-factor/enable",
            json!({ "code": code(&totp, current_step()) }),
            Some(&session),
        )
        .await;
    assert_eq!(enabled.status, StatusCode::OK);
    assert_eq!(enabled.body["recovery_codes"].as_array().unwrap().len(), 10);
    let subjects: Vec<_> = app
        .emails_to(EMAIL)
        .into_iter()
        .map(|(subject, _)| subject)
        .collect();
    assert_eq!(subjects, ["Two-step verification is on"]);

    let session = enabled.cookie("session");
    let on = app.get("/two-factor", &session).await;
    assert_eq!(
        on.body,
        json!({ "enabled": true, "recovery_codes_remaining": 10 })
    );

    let again = app
        .post(
            "/two-factor/setup",
            json!({ "password": PASSWORD }),
            Some(&session),
        )
        .await;
    assert_eq!(again.status, StatusCode::CONFLICT);
}

#[sqlx::test]
async fn turning_on_signs_out_every_other_session(pool: PgPool) {
    let app = TestApp::new(pool);
    let (user_id, here) = app.signed_in(EMAIL).await;
    let elsewhere = app.signin(EMAIL, PASSWORD).await.cookie("session");
    let totp = app.set_up(&here).await;

    let enabled = app
        .post(
            "/two-factor/enable",
            json!({ "code": code(&totp, current_step()) }),
            Some(&here),
        )
        .await;
    assert_eq!(enabled.status, StatusCode::OK);

    assert!(app.session(&elsewhere).await.body["user"].is_null());
    // Even this browser's old cookie, in case someone else holds a copy
    assert!(app.session(&here).await.body["user"].is_null());
    let renewed = app.session(&enabled.cookie("session")).await;
    assert_eq!(renewed.body["user"]["email"], EMAIL);
    let sessions = "SELECT count(*) FROM sessions WHERE user_id = $1";
    assert_eq!(app.count(sessions, user_id).await, 1);
}

#[sqlx::test]
async fn signing_in_takes_a_code_once_two_step_verification_is_on(pool: PgPool) {
    let app = TestApp::new(pool);
    let enrolled = app.enroll(EMAIL).await;

    let signin = app.signin(EMAIL, PASSWORD).await;
    assert_eq!(signin.status, StatusCode::OK);
    assert_eq!(signin.body, json!({ "status": "two_factor_required" }));
    assert!(signin.set_cookie("session").is_none());
    let set_cookie = signin.set_cookie("two_factor").unwrap();
    assert!(set_cookie.contains("; HttpOnly"));
    assert!(set_cookie.contains("Max-Age=300"));

    // Only its hash is stored
    let challenge = signin.cookie("two_factor");
    let value = challenge.split_once('=').unwrap().1;
    let stored: i64 =
        sqlx::query_scalar("SELECT count(*) FROM two_factor_challenges WHERE token_hash = $1")
            .bind(token::hash(value).as_slice())
            .fetch_one(&app.pool)
            .await
            .unwrap();
    assert_eq!(stored, 1);

    let without_challenge = app
        .post(
            "/signin/two-factor",
            json!({ "code": code(&enrolled.totp, enrolled.step + 1) }),
            None,
        )
        .await;
    assert_eq!(without_challenge.status, StatusCode::UNAUTHORIZED);

    let signed_in = app
        .second_factor(
            json!({ "code": code(&enrolled.totp, enrolled.step + 1) }),
            &challenge,
        )
        .await;
    assert_eq!(signed_in.status, StatusCode::OK);
    assert_eq!(signed_in.body["email"], EMAIL);
    assert!(
        signed_in
            .set_cookie("two_factor")
            .unwrap()
            .contains("Max-Age=0")
    );
    let session = app.session(&signed_in.cookie("session")).await;
    assert_eq!(session.body["user"]["email"], EMAIL);

    let spent = app
        .second_factor(
            json!({ "recovery_code": enrolled.recovery_codes[0] }),
            &challenge,
        )
        .await;
    assert_eq!(spent.status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn an_authenticator_code_signs_in_once(pool: PgPool) {
    let app = TestApp::new(pool);
    let enrolled = app.enroll(EMAIL).await;
    let next = code(&enrolled.totp, enrolled.step + 1);

    let first = app.challenge(EMAIL).await;
    let signed_in = app.second_factor(json!({ "code": next }), &first).await;
    assert_eq!(signed_in.status, StatusCode::OK);

    // Codes from that step, and the earlier one that turned two-step verification on, are spent
    let second = app.challenge(EMAIL).await;
    for spent in [next, code(&enrolled.totp, enrolled.step)] {
        let replay = app.second_factor(json!({ "code": spent }), &second).await;
        assert_eq!(replay.status, StatusCode::BAD_REQUEST);
        assert!(replay.body["details"]["code"].is_array());
    }
}

#[sqlx::test]
async fn five_wrong_codes_end_the_sign_in(pool: PgPool) {
    let app = TestApp::new(pool);
    let enrolled = app.enroll(EMAIL).await;
    let challenge = app.challenge(EMAIL).await;
    let wrong = json!({ "code": wrong_code(&enrolled.totp) });

    for _ in 0..4 {
        let attempt = app.second_factor(wrong.clone(), &challenge).await;
        assert_eq!(attempt.status, StatusCode::BAD_REQUEST);
        assert!(attempt.body["details"]["code"].is_array());
    }
    let fifth = app.second_factor(wrong, &challenge).await;
    assert_eq!(fifth.status, StatusCode::UNAUTHORIZED);

    let challenges = "SELECT count(*) FROM two_factor_challenges WHERE user_id = $1";
    assert_eq!(app.count(challenges, enrolled.user_id).await, 0);
    let right = app
        .second_factor(
            json!({ "code": code(&enrolled.totp, enrolled.step + 1) }),
            &challenge,
        )
        .await;
    assert_eq!(right.status, StatusCode::UNAUTHORIZED);

    let fresh = app.challenge(EMAIL).await;
    let signed_in = app
        .second_factor(
            json!({ "code": code(&enrolled.totp, enrolled.step + 1) }),
            &fresh,
        )
        .await;
    assert_eq!(signed_in.status, StatusCode::OK);
}

#[sqlx::test]
async fn a_recovery_code_signs_in_once(pool: PgPool) {
    let app = TestApp::new(pool);
    let enrolled = app.enroll(EMAIL).await;
    let [first, second, ..] = enrolled.recovery_codes.as_slice() else {
        unreachable!()
    };

    // As someone might copy it off paper
    let typed = first.to_uppercase().replace('-', " ");
    let signed_in = app
        .second_factor(
            json!({ "recovery_code": typed }),
            &app.challenge(EMAIL).await,
        )
        .await;
    assert_eq!(signed_in.status, StatusCode::OK);
    let status = app.get("/two-factor", &signed_in.cookie("session")).await;
    assert_eq!(status.body["recovery_codes_remaining"], 9);

    let challenge = app.challenge(EMAIL).await;
    let reused = app
        .second_factor(json!({ "recovery_code": first }), &challenge)
        .await;
    assert_eq!(reused.status, StatusCode::BAD_REQUEST);
    assert!(reused.body["details"]["recovery_code"].is_array());

    let other = app
        .second_factor(json!({ "recovery_code": second }), &challenge)
        .await;
    assert_eq!(other.status, StatusCode::OK);
}

#[sqlx::test]
async fn new_recovery_codes_and_turning_off_take_the_password(pool: PgPool) {
    let app = TestApp::new(pool);
    let enrolled = app.enroll(EMAIL).await;
    let session = &enrolled.session;
    let wrong_password = json!({ "password": "wrong password" });

    let refused = app
        .post(
            "/two-factor/recovery-codes",
            wrong_password.clone(),
            Some(session),
        )
        .await;
    assert_eq!(refused.status, StatusCode::BAD_REQUEST);
    assert!(refused.body["details"]["password"].is_array());

    let replaced = app
        .post(
            "/two-factor/recovery-codes",
            json!({ "password": PASSWORD }),
            Some(session),
        )
        .await;
    assert_eq!(replaced.status, StatusCode::OK);
    let fresh = replaced.body["recovery_codes"].as_array().unwrap();
    assert_eq!(fresh.len(), 10);
    assert!(fresh.iter().all(|code| {
        !enrolled
            .recovery_codes
            .contains(&code.as_str().unwrap().to_owned())
    }));

    let challenge = app.challenge(EMAIL).await;
    let old = app
        .second_factor(
            json!({ "recovery_code": enrolled.recovery_codes[0] }),
            &challenge,
        )
        .await;
    assert_eq!(old.status, StatusCode::BAD_REQUEST);
    let new = app
        .second_factor(json!({ "recovery_code": fresh[0] }), &challenge)
        .await;
    assert_eq!(new.status, StatusCode::OK);

    let refused = app
        .post("/two-factor/disable", wrong_password, Some(session))
        .await;
    assert_eq!(refused.status, StatusCode::BAD_REQUEST);
    assert!(refused.body["details"]["password"].is_array());
    assert_eq!(app.get("/two-factor", session).await.body["enabled"], true);

    let disabled = app
        .post(
            "/two-factor/disable",
            json!({ "password": PASSWORD }),
            Some(session),
        )
        .await;
    assert_eq!(disabled.status, StatusCode::NO_CONTENT);
    assert_eq!(
        app.get("/two-factor", session).await.body,
        json!({ "enabled": false, "recovery_codes_remaining": 0 })
    );
    let signin = app.signin(EMAIL, PASSWORD).await;
    assert_eq!(signin.body["status"], "signed_in");
    assert_eq!(signin.body["user"]["email"], EMAIL);

    for path in ["/two-factor/disable", "/two-factor/recovery-codes"] {
        let off = app
            .post(path, json!({ "password": PASSWORD }), Some(session))
            .await;
        assert_eq!(off.status, StatusCode::CONFLICT);
    }
}

#[sqlx::test]
async fn a_password_reset_ends_a_sign_in_waiting_for_its_code(pool: PgPool) {
    let app = TestApp::new(pool);
    let enrolled = app.enroll(EMAIL).await;
    let challenge = app.challenge(EMAIL).await;

    let token = app
        .link_token(enrolled.user_id, Purpose::ResetPassword)
        .await;
    let reset = app
        .post(
            "/reset-password",
            json!({ "token": token, "password": "new battery staple" }),
            None,
        )
        .await;
    assert_eq!(reset.status, StatusCode::OK);

    let ended = app
        .second_factor(
            json!({ "code": code(&enrolled.totp, enrolled.step + 1) }),
            &challenge,
        )
        .await;
    assert_eq!(ended.status, StatusCode::UNAUTHORIZED);

    // The reset changes the password, not the second factor
    let signin = app.signin(EMAIL, "new battery staple").await;
    assert_eq!(signin.body, json!({ "status": "two_factor_required" }));
}

#[sqlx::test]
async fn a_challenge_never_starts_for_a_password_that_was_replaced(pool: PgPool) {
    let app = TestApp::new(pool);
    let enrolled = app.enroll(EMAIL).await;
    let old_hash: String = sqlx::query_scalar("SELECT password FROM users WHERE id = $1")
        .bind(enrolled.user_id)
        .fetch_one(&app.pool)
        .await
        .unwrap();
    let new_hash = password::hash("new battery staple".into()).await.unwrap();
    crate::db::users::set_password(&app.pool, enrolled.user_id, &new_hash)
        .await
        .unwrap();

    // What a sign-in that checked the old password just before a reset tries to do
    let token = Token::generate().unwrap();
    let started = crate::db::two_factor::insert_challenge_if_password(
        &app.pool,
        &token.hash,
        enrolled.user_id,
        &old_hash,
        two_factor::CHALLENGE_TTL,
    )
    .await
    .unwrap();
    assert!(!started);
}
