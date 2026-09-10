# List recipes
default:
    @just --list

# Start backend (bacon) and frontend (vite) in one terminal
dev:
    mprocs

# Everything CI would run
check: check-rust check-web

check-rust:
    cargo clippy --workspace --all-targets -- -D warnings
    cargo run -q --bin openapi -- --check

check-web:
    pnpm --dir web check
    pnpm --dir web lint
    pnpm --dir web gen:api --check

# Regenerate openapi.json and the TypeScript API types
gen-api:
    cargo run -q --bin openapi
    pnpm --dir web gen:api

fmt:
    cargo fmt --all
    pnpm --dir web format

# Build frontend and backend for production
build: build-web build-server

# Bundle the SPA into web/dist
build-web:
    pnpm --dir web build

# Release binary; SQLX_OFFLINE uses the committed .sqlx cache instead of a live database
build-server:
    SQLX_OFFLINE=true cargo build --release -p server

# Apply pending migrations to DATABASE_URL
migrate:
    sqlx migrate run --source server/migrations

# Run the release binary; serves web/dist and the API on one port (needs `just build` first)
start:
    ./target/release/server

# Build, migrate, then start
prod: build migrate start
