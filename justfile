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
