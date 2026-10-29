use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use serde_json::{Value, json};
use sqlx::PgPool;
use url::Url;
use uuid::Uuid;
use webauthn_authenticator_rs::{WebauthnAuthenticator, softpasskey::SoftPasskey};
use webauthn_rs::prelude::{
    Base64UrlSafeData, CreationChallengeResponse, PublicKeyCredential, RequestChallengeResponse,
};
use webauthn_rs_proto::AllowCredentials;

use super::{PASSWORD, TestApp, TestResponse};

const APP_URL: &str = "http://localhost:5173";
const SIGN_IN_FAILED: &str = "This passkey could not sign you in";
const REJECTED: &str = "This passkey request is invalid or has expired";

/// A browser with a software authenticator. `SoftPasskey` predates discoverable credentials, so
/// the methods below fill in what it lacks; the server cannot tell the difference.
struct Browser {
    authenticator: WebauthnAuthenticator<SoftPasskey>,
    origin: Url,
}

impl Browser {
    fn new() -> Self {
        Self::at(APP_URL)
    }

    fn at(origin: &str) -> Self {
        Self {
            // `true` claims user verification, as a PIN or fingerprint would
            authenticator: WebauthnAuthenticator::new(SoftPasskey::new(true)),
            origin: Url::parse(origin).unwrap(),
        }
    }

    fn create(&mut self, options: &Value) -> Value {
        let mut options: CreationChallengeResponse =
            serde_json::from_value(options.clone()).unwrap();
        // It refuses to store a key; whether one was stored is the authenticator's business
        options
            .public_key
            .authenticator_selection
            .as_mut()
            .unwrap()
            .require_resident_key = false;
        let credential = self
            .authenticator
            .do_registration(self.origin.clone(), options)
            .unwrap();
        serde_json::to_value(credential).unwrap()
    }

    /// Answers with the passkey `credential_id` for `user_id`, as an authenticator that stored it
    /// would after the user picked it
    fn get(&mut self, options: &Value, credential_id: &Base64UrlSafeData, user_id: Uuid) -> Value {
        let mut options: RequestChallengeResponse =
            serde_json::from_value(options.clone()).unwrap();
        options.public_key.allow_credentials = vec![AllowCredentials {
            type_: "public-key".into(),
            id: credential_id.clone(),
            transports: None,
        }];
        let mut assertion: PublicKeyCredential = self
            .authenticator
            .do_authentication(self.origin.clone(), options)
            .unwrap();
        assertion.response.user_handle = Some(user_id.as_bytes().to_vec().into());
        serde_json::to_value(assertion).unwrap()
    }
}

/// A passkey registered in the browser, with what the server knows it by
struct Registered {
    id: Uuid,
    credential_id: Base64UrlSafeData,
}

impl TestApp {
    /// A verified account and the cookie of a session signed in to it
    async fn signed_in(&self, email: &str) -> (Uuid, String) {
        let user_id = self.verified_user(email).await;
        let cookie = self.signin(email, PASSWORD).await.cookie("session");
        (user_id, cookie)
    }

    async fn start_registration(&self, session: &str, password: &str) -> TestResponse {
        self.post(
            "/passkeys/registration/start",
            json!({ "password": password }),
            Some(session),
        )
        .await
    }

    async fn finish_registration(
        &self,
        session: &str,
        ceremony: &str,
        credential: &Value,
    ) -> TestResponse {
        self.post(
            "/passkeys/registration/finish",
            json!({ "credential": credential, "name": "Laptop" }),
            Some(&format!("{session}; {ceremony}")),
        )
        .await
    }

    async fn register(&self, browser: &mut Browser, session: &str) -> Registered {
        let started = self.start_registration(session, PASSWORD).await;
        assert_eq!(started.status, StatusCode::OK);
        let credential = browser.create(&started.body);
        let finished = self
            .finish_registration(session, &started.cookie("passkey_ceremony"), &credential)
            .await;
        assert_eq!(finished.status, StatusCode::OK);

        Registered {
            id: finished.body["id"].as_str().unwrap().parse().unwrap(),
            credential_id: serde_json::from_value(credential["rawId"].clone()).unwrap(),
        }
    }

    async fn start_sign_in(&self) -> TestResponse {
        self.post("/passkeys/signin/start", json!({}), None).await
    }

    async fn finish_sign_in(&self, ceremony: &str, assertion: &Value) -> TestResponse {
        self.post(
            "/passkeys/signin/finish",
            json!({ "credential": assertion }),
            Some(ceremony),
        )
        .await
    }

    async fn sign_in_with(
        &self,
        browser: &mut Browser,
        passkey: &Registered,
        user_id: Uuid,
    ) -> TestResponse {
        let started = self.start_sign_in().await;
        let assertion = browser.get(&started.body, &passkey.credential_id, user_id);
        self.finish_sign_in(&started.cookie("passkey_ceremony"), &assertion)
            .await
    }

    async fn passkeys(&self, session: &str) -> TestResponse {
        let request = Request::get("/api/auth/passkeys")
            .header(header::COOKIE, session)
            .body(Body::empty())
            .unwrap();
        self.send(request).await
    }

    async fn remove_passkey(&self, session: &str, id: &str, password: &str) -> TestResponse {
        let request = Request::delete(format!("/api/auth/passkeys/{id}"))
            .header(header::CONTENT_TYPE, "application/json")
            .header(header::COOKIE, session)
            .body(Body::from(json!({ "password": password }).to_string()))
            .unwrap();
        self.send(request).await
    }

    async fn expire_ceremonies(&self) {
        sqlx::query("UPDATE passkey_ceremonies SET expires_at = now() - interval '1 second'")
            .execute(&self.pool)
            .await
            .unwrap();
    }
}

#[sqlx::test]
async fn a_registered_passkey_signs_in_without_a_password(pool: PgPool) {
    let app = TestApp::new(pool);
    let (user_id, session) = app.signed_in("ada@example.com").await;
    let mut browser = Browser::new();

    let started = app.start_registration(&session, PASSWORD).await;
    let options = &started.body["publicKey"];
    assert_eq!(options["rp"]["id"], "localhost");
    assert_eq!(options["authenticatorSelection"]["residentKey"], "required");
    assert_eq!(
        options["authenticatorSelection"]["userVerification"],
        "required"
    );
    let ceremony = started.set_cookie("passkey_ceremony").unwrap();
    assert!(ceremony.contains("; HttpOnly"));
    assert!(ceremony.contains("Max-Age=300"));

    let credential = browser.create(&started.body);
    let finished = app
        .finish_registration(&session, &started.cookie("passkey_ceremony"), &credential)
        .await;
    assert_eq!(finished.status, StatusCode::OK);
    assert_eq!(finished.body["name"], "Laptop");
    assert!(finished.body["last_used_at"].is_null());
    assert!(
        finished
            .set_cookie("passkey_ceremony")
            .unwrap()
            .contains("Max-Age=0")
    );
    let passkey = Registered {
        id: finished.body["id"].as_str().unwrap().parse().unwrap(),
        credential_id: serde_json::from_value(credential["rawId"].clone()).unwrap(),
    };

    // The same authenticator cannot be registered twice
    let again = app.start_registration(&session, PASSWORD).await;
    let excluded = again.body["publicKey"]["excludeCredentials"]
        .as_array()
        .unwrap();
    assert_eq!(excluded.len(), 1);
    assert_eq!(excluded[0]["id"], credential["rawId"]);

    let signed_in = app.sign_in_with(&mut browser, &passkey, user_id).await;
    assert_eq!(signed_in.status, StatusCode::OK);
    assert_eq!(signed_in.body["email"], "ada@example.com");
    let new_session = app.session(&signed_in.cookie("session")).await;
    assert_eq!(new_session.body["user"]["email"], "ada@example.com");

    let listed = app.passkeys(&session).await;
    assert_eq!(listed.headers[header::CACHE_CONTROL], "no-store");
    assert_eq!(listed.body[0]["id"], passkey.id.to_string());
    assert!(listed.body[0]["last_used_at"].is_string());

    // The counter the authenticator reported is kept, so a cloned key replaying an older one fails
    let counter: String =
        sqlx::query_scalar("SELECT passkey #>> '{cred,counter}' FROM passkeys WHERE id = $1")
            .bind(passkey.id)
            .fetch_one(&app.pool)
            .await
            .unwrap();
    assert_eq!(counter, "1");
    let second = app.sign_in_with(&mut browser, &passkey, user_id).await;
    assert_eq!(second.status, StatusCode::OK);
}

#[sqlx::test]
async fn adding_and_removing_a_passkey_needs_the_password(pool: PgPool) {
    let app = TestApp::new(pool);
    let (_, session) = app.signed_in("ada@example.com").await;
    let mut browser = Browser::new();

    let wrong = app.start_registration(&session, "wrong password").await;
    assert_eq!(wrong.status, StatusCode::BAD_REQUEST);
    assert!(wrong.body["details"]["password"].is_array());
    assert!(wrong.set_cookie("passkey_ceremony").is_none());

    let signed_out = app
        .post(
            "/passkeys/registration/start",
            json!({ "password": PASSWORD }),
            None,
        )
        .await;
    assert_eq!(signed_out.status, StatusCode::UNAUTHORIZED);

    let passkey = app.register(&mut browser, &session).await;
    let id = passkey.id.to_string();
    let kept = app.remove_passkey(&session, &id, "wrong password").await;
    assert_eq!(kept.status, StatusCode::BAD_REQUEST);
    assert!(kept.body["details"]["password"].is_array());
    assert_eq!(
        app.passkeys(&session).await.body.as_array().unwrap().len(),
        1
    );

    let removed = app.remove_passkey(&session, &id, PASSWORD).await;
    assert_eq!(removed.status, StatusCode::NO_CONTENT);
    assert_eq!(app.passkeys(&session).await.body, json!([]));
}

#[sqlx::test]
async fn passkeys_are_only_ever_their_owners(pool: PgPool) {
    let app = TestApp::new(pool);
    let (ada, ada_session) = app.signed_in("ada@example.com").await;
    let (grace, grace_session) = app.signed_in("grace@example.com").await;
    let mut browser = Browser::new();
    let passkey = app.register(&mut browser, &ada_session).await;

    assert_eq!(app.passkeys(&grace_session).await.body, json!([]));
    let id = passkey.id.to_string();
    let theirs = app.remove_passkey(&grace_session, &id, PASSWORD).await;
    assert_eq!(theirs.status, StatusCode::NOT_FOUND);
    let malformed = app
        .remove_passkey(&grace_session, "not-a-uuid", PASSWORD)
        .await;
    assert_eq!(malformed.status, StatusCode::NOT_FOUND);
    assert_eq!(
        app.passkeys(&ada_session)
            .await
            .body
            .as_array()
            .unwrap()
            .len(),
        1
    );

    // Ada's registration, finished from Grace's session in the same browser
    let started = app.start_registration(&ada_session, PASSWORD).await;
    let credential = Browser::new().create(&started.body);
    let crossed = app
        .finish_registration(
            &grace_session,
            &started.cookie("passkey_ceremony"),
            &credential,
        )
        .await;
    assert_eq!(crossed.status, StatusCode::BAD_REQUEST);
    assert_eq!(crossed.body["error"], REJECTED);

    // Ada's passkey, presented as if it were Grace's
    let impostor = app.sign_in_with(&mut browser, &passkey, grace).await;
    assert_eq!(impostor.status, StatusCode::UNAUTHORIZED);
    assert!(impostor.set_cookie("session").is_none());
    assert_eq!(
        app.sign_in_with(&mut browser, &passkey, ada).await.status,
        StatusCode::OK
    );
}

#[sqlx::test]
async fn unverified_accounts_cannot_sign_in_with_a_passkey(pool: PgPool) {
    let app = TestApp::new(pool);
    let (user_id, session) = app.signed_in("ada@example.com").await;
    let mut browser = Browser::new();
    let passkey = app.register(&mut browser, &session).await;
    sqlx::query("UPDATE users SET verified_at = NULL WHERE id = $1")
        .bind(user_id)
        .execute(&app.pool)
        .await
        .unwrap();

    let refused = app.sign_in_with(&mut browser, &passkey, user_id).await;
    assert_eq!(refused.status, StatusCode::FORBIDDEN);
    assert!(refused.set_cookie("session").is_none());
}

#[sqlx::test]
async fn a_sign_in_challenge_works_once_and_expires(pool: PgPool) {
    let app = TestApp::new(pool);
    let (user_id, session) = app.signed_in("ada@example.com").await;
    let mut browser = Browser::new();
    let passkey = app.register(&mut browser, &session).await;

    let started = app.start_sign_in().await;
    let ceremony = started.cookie("passkey_ceremony");
    let assertion = browser.get(&started.body, &passkey.credential_id, user_id);
    assert_eq!(
        app.finish_sign_in(&ceremony, &assertion).await.status,
        StatusCode::OK
    );
    let replayed = app.finish_sign_in(&ceremony, &assertion).await;
    assert_eq!(replayed.status, StatusCode::UNAUTHORIZED);
    assert_eq!(replayed.body["error"], SIGN_IN_FAILED);

    // A failed attempt uses the challenge up as well
    let started = app.start_sign_in().await;
    let ceremony = started.cookie("passkey_ceremony");
    let assertion = browser.get(&started.body, &passkey.credential_id, user_id);
    let mut forged = assertion.clone();
    forged["response"]["signature"] = json!("AAAA");
    assert_eq!(
        app.finish_sign_in(&ceremony, &forged).await.status,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        app.finish_sign_in(&ceremony, &assertion).await.status,
        StatusCode::UNAUTHORIZED
    );

    let started = app.start_sign_in().await;
    let assertion = browser.get(&started.body, &passkey.credential_id, user_id);
    app.expire_ceremonies().await;
    let expired = app
        .finish_sign_in(&started.cookie("passkey_ceremony"), &assertion)
        .await;
    assert_eq!(expired.status, StatusCode::UNAUTHORIZED);

    let without_cookie = app.finish_sign_in("", &assertion).await;
    assert_eq!(without_cookie.status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test]
async fn a_registration_challenge_works_once_and_expires(pool: PgPool) {
    let app = TestApp::new(pool);
    let (_, session) = app.signed_in("ada@example.com").await;
    let mut browser = Browser::new();

    let started = app.start_registration(&session, PASSWORD).await;
    let ceremony = started.cookie("passkey_ceremony");
    let credential = browser.create(&started.body);
    assert_eq!(
        app.finish_registration(&session, &ceremony, &credential)
            .await
            .status,
        StatusCode::OK
    );
    let replayed = app
        .finish_registration(&session, &ceremony, &credential)
        .await;
    assert_eq!(replayed.status, StatusCode::BAD_REQUEST);
    assert_eq!(replayed.body["error"], REJECTED);

    let started = app.start_registration(&session, PASSWORD).await;
    let credential = Browser::new().create(&started.body);
    app.expire_ceremonies().await;
    let expired = app
        .finish_registration(&session, &started.cookie("passkey_ceremony"), &credential)
        .await;
    assert_eq!(expired.status, StatusCode::BAD_REQUEST);
    assert_eq!(expired.body["error"], REJECTED);

    // A sign-in challenge cannot stand in for a registration one
    let sign_in = app.start_sign_in().await;
    let crossed = app
        .finish_registration(&session, &sign_in.cookie("passkey_ceremony"), &credential)
        .await;
    assert_eq!(crossed.status, StatusCode::BAD_REQUEST);

    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM passkeys")
        .fetch_one(&app.pool)
        .await
        .unwrap();
    assert_eq!(count, 1);
}

#[sqlx::test]
async fn https_deployments_get_a_secure_host_only_ceremony_cookie(pool: PgPool) {
    let app = TestApp::with_app_url(pool, "https://wa.example.com");

    let started = app.start_sign_in().await;
    assert_eq!(started.body["publicKey"]["rpId"], "wa.example.com");
    let cookie = started.set_cookie("__Host-passkey_ceremony").unwrap();
    assert!(cookie.contains("; Secure"));
    assert!(cookie.contains("; HttpOnly"));
}
