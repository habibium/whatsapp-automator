mod error;
mod extract;
mod routes;

use axum::Router;
use sqlx::PgPool;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
}

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
