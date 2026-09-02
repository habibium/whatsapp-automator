use axum::{Json, extract::Path};
use serde::Serialize;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::{OpenApi, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};
use utoipa_scalar::{Scalar, Servable as ScalarServable};

const PORT: u16 = 8000;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,server=debug,tower_http=debug")),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(hello))
        .routes(routes!(get_pet_by_id))
        .split_for_parts();

    let app = router
        .merge(Scalar::with_url("/api/docs", api))
        .layer(TraceLayer::new_for_http());

    let Ok(listener) = TcpListener::bind(format!("0.0.0.0:{PORT}")).await else {
        tracing::error!(port = PORT, "failed to bind, port might be already in use");
        std::process::exit(1);
    };

    axum::serve(listener, app).await.unwrap();
}

#[derive(OpenApi)]
#[openapi(info(title = "whatsapp-automator"))]
struct ApiDoc;

#[derive(Serialize, ToSchema)]
struct Pet {
    id: u64,
    name: String,
    age: Option<i32>,
}

/// Hello world
#[utoipa::path(get, path = "/api/hello", responses((status = OK, body = str)))]
async fn hello() -> &'static str {
    "Hello, World!"
}

/// Get pet by {id}
#[utoipa::path(get, path = "/api/pets/{id}", responses((status = OK, body = Pet)))]
async fn get_pet_by_id(Path(pet_id): Path<u64>) -> Json<Pet> {
    Json(Pet {
        id: pet_id,
        age: None,
        name: "lightning".to_string(),
    })
}
