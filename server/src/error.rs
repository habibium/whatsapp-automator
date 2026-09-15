use std::collections::HashMap;

use axum::{
    Json,
    extract::rejection::JsonRejection,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Unauthorized")]
    #[expect(dead_code)]
    Unauthorized,

    #[error("Not Found")]
    NotFound,

    #[error("Validation Failed")]
    Validation(#[from] validator::ValidationErrors),

    #[error("{0}")]
    Conflict(&'static str),

    #[error("{}", .0.body_text())]
    Json(#[from] JsonRejection),

    #[error(transparent)]
    Db(#[from] sqlx::Error),

    #[error(transparent)]
    Internal(#[from] anyhow::Error),
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

            Self::Conflict(_) => (StatusCode::CONFLICT, self.to_string(), None),

            Self::Json(_) => (StatusCode::BAD_REQUEST, self.to_string(), None),

            Self::Db(e) => {
                tracing::error!(error = ?e, "database error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".into(),
                    None,
                )
            }

            Self::Internal(e) => {
                tracing::error!(error = ?e, "internal server error");
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
