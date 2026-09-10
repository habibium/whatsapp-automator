use std::{net::Ipv4Addr, path::Path};

use anyhow::Context;
use server::state::AppState;
use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tower_http::{
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use utoipa_scalar::{Scalar, Servable as ScalarServable};

const PORT: u16 = 8000;
const WEB_PATH: &str = "web/dist";

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // tracing
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("info,server=debug,tower_http=debug")),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    // setup db pool
    dotenvy::dotenv().with_context(|| "Error failed to load .env")?;
    let database_url = dotenvy::var("DATABASE_URL")?;
    let pool = PgPoolOptions::new().connect(&database_url).await?;

    let (router, api) = server::router();
    let web_path = Path::new(WEB_PATH);
    let web = ServeDir::new(web_path).fallback(ServeFile::new(web_path.join("index.html")));

    let app = router
        .fallback_service(web)
        .with_state(AppState { pool })
        .merge(Scalar::with_url("/api/docs", api))
        .layer(TraceLayer::new_for_http());

    let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, PORT)).await?;
    tracing::info!("server running on http://{}", listener.local_addr()?);

    axum::serve(listener, app).await?;

    Ok(())
}
