use axum::{Json, extract::State, http::StatusCode};
use serde::Serialize;
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};

use crate::state::AppState;

#[derive(Serialize, ToSchema)]
pub struct Health {
    status: &'static str,
}

/// Health check
///
/// Reports whether the database is reachable
#[utoipa::path(get, path = "/health", responses(
    (status = OK, body = Health),
    (status = SERVICE_UNAVAILABLE, body = Health),
))]
pub async fn health(State(state): State<AppState>) -> (StatusCode, Json<Health>) {
    match sqlx::query("SELECT 1").execute(&state.pool).await {
        Ok(_) => (StatusCode::OK, Json(Health { status: "ok" })),
        Err(e) => {
            tracing::error!(error = ?e, "health check failed");
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(Health { status: "degraded" }),
            )
        }
    }
}

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new().routes(routes!(health))
}
