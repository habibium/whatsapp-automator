use utoipa_axum::{router::OpenApiRouter, routes};

use crate::state::AppState;

mod dto;
mod handlers;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(handlers::get_two_factor))
        .routes(routes!(handlers::setup_two_factor))
        .routes(routes!(handlers::enable_two_factor))
        .routes(routes!(handlers::disable_two_factor))
        .routes(routes!(handlers::regenerate_recovery_codes))
        .routes(routes!(handlers::verify_two_factor))
}
