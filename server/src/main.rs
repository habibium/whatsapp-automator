use axum::{Json, Router, extract::Path, routing::get};
use serde::Serialize;
use serde_json::{Value, json};
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::{
    Modify, OpenApi, ToSchema,
    openapi::security::{ApiKey, ApiKeyValue, SecurityScheme},
};
use utoipa_axum::router::OpenApiRouter;
use utoipa_scalar::{Scalar, Servable as ScalarServable};

const SERVER_TAG: &str = "whatsapp-automator";
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

    let app = Router::new()
        .route("/api/hello", get(|| async { "Hello, World!" }))
        .route("/api/pets/{id}", get(get_pet_by_id))
        .route("/api/openapi.json", get(get_openapi))
        .merge(Scalar::with_url("/api/docs", ApiDoc::openapi()))
        .layer(TraceLayer::new_for_http());

    // let (router, api) = OpenApiRouter::with_openapi(ApiDoc::openapi()).split_for_parts();

    let Ok(listener) = TcpListener::bind(format!("0.0.0.0:{PORT}")).await else {
        tracing::error!(port = PORT, "failed to bind, port might be already in use");
        std::process::exit(1);
    };

    axum::serve(listener, app).await.unwrap();
}

#[derive(OpenApi)]
#[openapi(
    modifiers(&SecurityAddon),

        tags(
            (name = SERVER_TAG, description = "Whatsapp automator API")
        )
    )]
struct ApiDoc;

struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "api_key",
                SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::new("todo_apikey"))),
            );
        }
    }
}

#[derive(Serialize, ToSchema)]
struct Pet {
    id: u64,
    name: String,
    age: Option<i32>,
}

/// Get pet by id
///
/// Get pet from database by pet id
#[utoipa::path(
    get,
    path = "/pets/{id}",
    responses(
        (status = 200, description = "Pet found successfully", body = Pet),
        (status = NOT_FOUND, description = "Pet was not found")
    ),
    params(
        ("id" = u64, Path, description = "Pet database id to get Pet for"),
    )
)]
async fn get_pet_by_id(Path(pet_id): Path<u64>) -> Json<Pet> {
    Json(Pet {
        id: pet_id,
        age: None,
        name: "lightning".to_string(),
    })
}

async fn get_openapi() -> Json<Value> {
    Json(json!(ApiDoc::openapi()))
}
