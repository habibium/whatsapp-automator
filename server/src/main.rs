use axum::{Router, routing::get};
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

const PORT: u16 = 8000;

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .init();

    let app = Router::new()
        .route("/api/hello", get(|| async { "Hello, World!" }))
        .layer(TraceLayer::new_for_http());

    let Ok(listener) = TcpListener::bind(format!("0.0.0.0:{PORT}")).await else {
        tracing::error!("Failed to bind to port {}", PORT);
        std::process::exit(1);
    };

    axum::serve(listener, app).await.unwrap();
}
