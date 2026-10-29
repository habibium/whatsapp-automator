mod auth;
pub mod config;
pub mod crypto;
mod csrf;
mod db;
pub mod email;
mod error;
mod extract;
mod routes;
pub mod state;

use axum::{Router, middleware, routing::any};
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;

pub use crate::db::spawn_cleanup;
use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(info(title = "whatsapp-automator"))]
struct ApiDoc;

pub fn router() -> (Router<AppState>, utoipa::openapi::OpenApi) {
    OpenApiRouter::with_openapi(ApiDoc::openapi())
        .nest(
            "/api",
            OpenApiRouter::new()
                .merge(routes::health::router())
                .nest("/auth", routes::auth::router())
                // on the nested router so unknown /api paths 404 instead of falling
                // through to the SPA fallback in main.rs
                .fallback(routes::not_found)
                .layer(middleware::from_fn(csrf::reject_cross_site_writes)),
        )
        // that fallback's catch-all needs a non-empty suffix, so bare "/api/" misses it
        .route("/api/", any(routes::not_found))
        .split_for_parts()
}
