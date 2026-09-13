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

# Build the production image locally
docker-build:
    docker build -t whatsapp-automator .

# Preview the changelog entries since the last release
changelog:
    git cliff --unreleased --strip all

# Bump the server version, regenerate CHANGELOG.md, commit, tag vX.Y.Z and push; the Release workflow builds, deploys and publishes it
release version:
    #!/usr/bin/env sh
    set -eu
    git diff --quiet && git diff --cached --quiet || { echo "commit or stash your changes first"; exit 1; }
    sed -i 's/^version = ".*"/version = "{{version}}"/' server/Cargo.toml
    cargo update --workspace --offline
    git cliff --tag "v{{version}}" -o CHANGELOG.md
    git add server/Cargo.toml Cargo.lock CHANGELOG.md
    git commit -m "chore: release v{{version}}"
    git tag -a "v{{version}}" -m "v{{version}}"
    git push origin HEAD "v{{version}}"
