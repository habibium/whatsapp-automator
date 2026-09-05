# whatsapp-automator

Schedule and send WhatsApp messages. Rust backend (`server/`, axum) and a React frontend (`web/`, Vite + TanStack).

## Prerequisites

- Rust nightly (`rustup toolchain install nightly`), plus `cargo install bacon just mprocs`
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

Run `just` alone to list recipes.
