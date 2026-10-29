use std::{collections::HashMap, time::Duration};

use axum::{
    Json,
    extract::rejection::JsonRejection,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Unauthorized")]
    Unauthorized,

    #[error("Incorrect email or password")]
    InvalidCredentials,

    #[error("Verify your email address before signing in")]
    EmailNotVerified,

    /// The signed-in user's password, asked again before a sensitive change, did not match
    #[expect(
        dead_code,
        reason = "constructed by `auth::reauth`, which has no caller yet"
    )]
    #[error("Validation Failed")]
    IncorrectPassword,

    #[error("This link is invalid or has expired")]
    InvalidToken,

    #[error("Cross-site request refused")]
    CrossSite,

    #[error("Not Found")]
    NotFound,

    /// Carries how long until the client may try again
    #[error("Too many attempts, try again later")]
    TooManyRequests(Duration),

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
        // Rounded up, so a client that waits exactly this long is let through
        let retry_after = match &self {
            Self::TooManyRequests(wait) => Some([(
                header::RETRY_AFTER,
                wait.as_secs() + u64::from(wait.subsec_nanos() > 0),
            )]),
            _ => None,
        };

        let (status, message, details) = match self {
            Self::Unauthorized | Self::InvalidCredentials => {
                (StatusCode::UNAUTHORIZED, self.to_string(), None)
            }

            Self::EmailNotVerified | Self::CrossSite => {
                (StatusCode::FORBIDDEN, self.to_string(), None)
            }

            Self::NotFound => (StatusCode::NOT_FOUND, self.to_string(), None),

            Self::TooManyRequests(_) => (StatusCode::TOO_MANY_REQUESTS, self.to_string(), None),

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

            Self::IncorrectPassword => (
                StatusCode::BAD_REQUEST,
                self.to_string(),
                Some(HashMap::from([(
                    "password".into(),
                    vec!["is incorrect".into()],
                )])),
            ),

            Self::Conflict(_) => (StatusCode::CONFLICT, self.to_string(), None),

            Self::InvalidToken | Self::Json(_) => (StatusCode::BAD_REQUEST, self.to_string(), None),

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
            retry_after,
            Json(ErrorBody {
                error: message,
                details,
            }),
        )
            .into_response()
    }
}
