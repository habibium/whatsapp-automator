use std::collections::HashMap;

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Unauthorized")]
    Unauthorized,
    #[error("Not Found")]
    NotFound,
    #[error("Validation Failed")]
    Validation(#[from] validator::ValidationErrors),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorBody {
    error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<HashMap<String, Vec<String>>>,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message, details) = match self {
            Self::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string(), None),
            Self::NotFound => (StatusCode::NOT_FOUND, self.to_string(), None),
            Self::Validation(e) => {
                let details = e
                    .field_errors()
                    .into_iter()
                    .map(|(field, errors)| {
                        let messages = errors
                            .iter()
                            .map(|e| e.message.as_deref().unwrap_or(&e.code).to_string())
                            .collect();
                        (field.to_string(), messages)
                    })
                    .collect();

                (
                    StatusCode::BAD_REQUEST,
                    "Validation Failed".into(),
                    Some(details),
                )
            }
            Self::Db(e) => {
                tracing::error!(error = ?e, "database error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".into(),
                    None,
                )
            }
        };

        (
            status,
            Json(ErrorBody {
                error: message,
                details,
            }),
        )
            .into_response()
    }
}
