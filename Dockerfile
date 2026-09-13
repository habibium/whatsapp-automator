FROM node:24-alpine AS web
WORKDIR /app/web
RUN npm install -g pnpm
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY openapi.json /app/openapi.json
COPY web ./
RUN pnpm build

FROM rust:1-slim-bookworm AS server
WORKDIR /app
ENV SQLX_OFFLINE=true
COPY Cargo.toml Cargo.lock ./
COPY .sqlx ./.sqlx
COPY server ./server
# cache mounts keep the registry and target dir between builds; the binary is copied out because mounts vanish
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/app/target \
    cargo build --release -p server --bin server && cp target/release/server /server

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 1001 app
WORKDIR /app
COPY --from=server /server /usr/local/bin/server
COPY --from=web /app/web/dist ./web/dist
ENV PORT=8000 \
    WEB_DIR=/app/web/dist \
    RUST_LOG=info
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -fsS http://localhost:8000/api/health || exit 1
CMD ["server"]
