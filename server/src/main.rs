use std::net::Ipv4Addr;

use axum::{
    Router,
    http::{HeaderValue, header},
    response::Response,
};
use server::{config::Config, state::AppState};
use sqlx::postgres::PgPoolOptions;
use tokio::net::TcpListener;
use tower_http::{
    compression::{
        CompressionLayer, CompressionLevel,
        predicate::{DefaultPredicate, NotForContentType, Predicate},
    },
    services::{ServeDir, ServeFile},
    set_header::SetResponseHeaderLayer,
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

    // `precompressed_*` serves the .br/.gz siblings the web build emits, so the
    // CompressionLayer below only ever has to compress API and docs responses.
    let index = ServeFile::new(config.web_dir.join("index.html"))
        .precompressed_br()
        .precompressed_gzip();
    let web = ServeDir::new(&config.web_dir)
        .precompressed_br()
        .precompressed_gzip()
        .fallback(index);
    let assets = ServeDir::new(config.web_dir.join("assets"))
        .precompressed_br()
        .precompressed_gzip();

    // Only /assets/* filenames are content-hashed, so nothing else may be cached;
    // a 404 there must not be pinned either, or a mid-deploy miss sticks for a year.
    let assets_router =
        Router::new()
            .fallback_service(assets)
            .layer(SetResponseHeaderLayer::overriding(
                header::CACHE_CONTROL,
                |res: &Response| {
                    res.status()
                        .is_success()
                        .then(|| HeaderValue::from_static("public, max-age=31536000, immutable"))
                },
            ));
    let web_router = Router::new()
        .fallback_service(web)
        .layer(SetResponseHeaderLayer::overriding(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-cache"),
        ));

    let app = router
        .fallback_service(web_router)
        .with_state(AppState { pool })
        .merge(Scalar::with_url("/api/docs", api))
        .nest_service("/assets", assets_router)
        .layer(
            CompressionLayer::new()
                .br(true)
                .gzip(true)
                .quality(CompressionLevel::Fastest)
                // woff2 is already compressed; encoding it only adds bytes
                .compress_when(DefaultPredicate::new().and(NotForContentType::const_new("font/"))),
        )
        .layer(TraceLayer::new_for_http());

    let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, config.port)).await?;
    tracing::info!("server running on http://{}", listener.local_addr()?);

    axum::serve(listener, app).await?;

    Ok(())
}
