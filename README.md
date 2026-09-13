# whatsapp-automator

Schedule and send WhatsApp messages. Rust backend (`server/`, axum) and a React frontend (`web/`, Vite + TanStack).

## Prerequisites

- Rust nightly (`rustup toolchain install nightly`), plus `cargo install bacon just mprocs git-cliff`
- Node 24+ and `pnpm`

## Development

```sh
just dev
```

Starts both processes in one terminal via [mprocs](https://github.com/pvolok/mprocs):

| Process  | Command    | URL                                         |
| -------- | ---------- | ------------------------------------------- |
| `server` | `bacon`    | http://localhost:8000 (docs at `/api/docs`) |
| `web`    | `pnpm dev` | http://localhost:5173                       |

mprocs keys: `Ctrl+a` toggles focus between the process list and the terminal, `j`/`k` select a process, `r` restarts it, `q` quits everything. With the terminal focused, keys go to the process, so bacon's shortcuts (`c` clippy, `/` search) still work.

You can also run the two halves in separate panes: `bacon` at the root and `pnpm dev` inside `web/`.

## Typesafe API contract

The backend is the source of truth. utoipa derives an OpenAPI spec from the axum routes; the frontend generates TypeScript types from it.

```
server/src/lib.rs  ──cargo run --bin openapi──▶  openapi.json  ──openapi-typescript──▶  web/src/api/schema.d.ts
```

Both steps run automatically in `just dev`: bacon regenerates `openapi.json` before every server restart, and a Vite plugin watches that file and regenerates `schema.d.ts`. Both generated files are committed, and `just check` fails if either is out of date.

To run the generation by hand: `just gen-api`.

## Commands

| Recipe         | What it does                                                    |
| -------------- | --------------------------------------------------------------- |
| `just dev`     | Start backend and frontend                                      |
| `just check`   | Clippy, OpenAPI freshness, formatting, lint, TS types freshness |
| `just fmt`     | Format Rust and TypeScript                                      |
| `just gen-api` | Regenerate `openapi.json` and `schema.d.ts`                     |
| `just build`   | Production build: `web/dist` and the release binary             |
| `just start`   | Run the release binary, serving the SPA and the API on one port |
| `just release` | Tag a version and push; CI builds, deploys and publishes it     |

Run `just` alone to list recipes.

## Configuration

Environment variables, or a `.env` file in development (see `.env.example`):

| Variable       | Default                | Purpose                                    |
| -------------- | ---------------------- | ------------------------------------------ |
| `DATABASE_URL` | required               | Postgres connection string                 |
| `PORT`         | `8000`                 | Listen port                                |
| `WEB_DIR`      | `web/dist`             | Built SPA to serve for non-`/api` paths    |
| `RUST_LOG`     | `info,server=debug,…`  | tracing filter                             |

Migrations in `server/migrations` are embedded in the binary and applied at startup.

## Deployment

Releases are cut from the `rewrite` branch until it merges into `main`.

```sh
just release 0.1.0
```

That bumps `server/Cargo.toml`, regenerates `CHANGELOG.md` from the commit history with [git-cliff](https://git-cliff.org) (`cliff.toml` maps conventional commit types to sections), commits, tags `v0.1.0` and pushes. The Release workflow then builds the image, pushes it to `ghcr.io/habibium/whatsapp-automator` (tagged `0.1.0`, `0.1` and `latest`), tells Dokploy on the VPS to deploy it, and publishes a GitHub release whose notes are the changelog section for that version. `just changelog` previews the entries since the last release. A tag with a suffix such as `v0.2.0-rc.1` is marked as a pre-release.

### One-time Dokploy setup

The image is built in CI, so the VPS only pulls and runs it.

1. **Database.** Create a Postgres service in the Dokploy project. Its internal hostname is the service name, so `DATABASE_URL` looks like `postgres://user:pass@<service>:5432/<db>`.
2. **Application.** Create an application with the *Docker* provider and image `ghcr.io/habibium/whatsapp-automator:latest`. If the GHCR package is private, add a GitHub token with `read:packages` as the registry credentials. Under *Environment* set `DATABASE_URL`. Under *Domains* add the host with container port `8000`; Dokploy's Traefik terminates TLS.
3. **Zero-downtime.** In *Advanced → Cluster Settings* set the update config to `{"FailureAction": "rollback", "Order": "start-first"}` and a health check on `/api/health`, as the Dokploy production guide recommends.
4. **API key.** Generate one under *Settings → Profile → API/CLI*. The application id is the last segment of the application's URL in Dokploy.

Repository secrets used by the workflow:

| Name                     | Value                                              |
| ------------------------ | -------------------------------------------------- |
| `DOKPLOY_URL`            | `https://dokploy.example.com`, no trailing slash   |
| `DOKPLOY_API_KEY`        | the generated key                                  |
| `DOKPLOY_APPLICATION_ID` | the application id                                 |

Each release sets the application's image to the exact version tag through the API and triggers a deploy, so Dokploy always shows which version is running and rollback is a matter of pointing it back at an older tag.

### Running the image elsewhere

```sh
docker run -p 8000:8000 -e DATABASE_URL=postgres://… ghcr.io/habibium/whatsapp-automator:latest
```

`just docker-build` builds the same image locally.
