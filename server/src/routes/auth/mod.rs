use utoipa_axum::{router::OpenApiRouter, routes};

use crate::state::AppState;

mod dto;
mod handlers;
#[cfg(test)]
mod tests;
mod two_factor;

pub fn router() -> OpenApiRouter<AppState> {
    OpenApiRouter::new()
        .routes(routes!(handlers::signup))
        .routes(routes!(handlers::signin))
        .routes(routes!(handlers::signout))
        .routes(routes!(handlers::get_session))
        .routes(routes!(handlers::verify_email))
        .routes(routes!(handlers::resend_verification))
        .routes(routes!(handlers::forgot_password))
        .routes(routes!(handlers::reset_password))
        .merge(two_factor::router())
}
