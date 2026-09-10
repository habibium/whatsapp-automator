mod db;
mod error;
mod extract;
mod routes;
pub mod state;

use axum::Router;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;

use crate::state::AppState;

#[derive(OpenApi)]
#[openapi(info(title = "whatsapp-automator"))]
struct ApiDoc;

pub fn router() -> (Router<AppState>, utoipa::openapi::OpenApi) {
    OpenApiRouter::with_openapi(ApiDoc::openapi())
        .nest(
            "/api",
            OpenApiRouter::new().nest("/auth", routes::auth::router()),
        )
        .split_for_parts()
}
