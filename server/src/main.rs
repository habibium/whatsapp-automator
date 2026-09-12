use std::net::Ipv4Addr;

use server::{config::Config, state::AppState};
use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tower_http::{
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};
use utoipa_scalar::{Scalar, Servable as ScalarServable};

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

    // .env is a dev convenience; production supplies real environment variables
    dotenvy::dotenv().ok();
    let config = Config::from_env()?;

    let pool = PgPoolOptions::new().connect(&config.database_url).await?;
    sqlx::migrate!().run(&pool).await?;

    let (router, api) = server::router();
    let web =
        ServeDir::new(&config.web_dir).fallback(ServeFile::new(config.web_dir.join("index.html")));

    let app = router
        .fallback_service(web)
        .with_state(AppState { pool })
        .merge(Scalar::with_url("/api/docs", api))
        .layer(TraceLayer::new_for_http());

    let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, config.port)).await?;
    tracing::info!("server running on http://{}", listener.local_addr()?);

    axum::serve(listener, app).await?;

    Ok(())
}
