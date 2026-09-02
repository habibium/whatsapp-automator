use axum::{Json, Router, extract::Path};
use serde::Serialize;
use utoipa::{OpenApi, ToSchema};
use utoipa_axum::{router::OpenApiRouter, routes};

#[derive(OpenApi)]
#[openapi(info(title = "whatsapp-automator"))]
struct ApiDoc;

pub fn router() -> (Router, utoipa::openapi::OpenApi) {
    OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(hello))
        .routes(routes!(get_pet_by_id))
        .split_for_parts()
}

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
