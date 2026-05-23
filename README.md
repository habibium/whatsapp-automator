# WA Scheduler

Schedule WhatsApp messages reliably — one-time or on a recurring cron — from a clean, server-driven web app.

## Why

This is a from-scratch rewrite designed to eliminate the structural defects of the original codebase:

- The scheduler **owns the WhatsApp connection** and reconnects every paired session on boot — messages send unattended, no browser tab required.
- Scheduling lives in **pg-boss**, a durable Postgres-backed queue. Restarting the server doesn't drop pending jobs.
- Every delivery attempt is recorded with status (`pending` / `sent` / `failed`) and surfaced in a history view.
- WhatsApp credentials and Signal keys are **encrypted at rest** (AES-256-GCM), one row per key.
- The web client is fully typed against the server through **Hono RPC** — no codegen, no API drift.

## Stack

- **Monorepo** — pnpm workspaces + Turborepo
- **Server** — Hono on Node 24, Drizzle ORM (node-postgres), Better Auth, pg-boss, Baileys
- **Web** — React 19, Vite 7, Tailwind 4, shadcn/ui, React Router v7, TanStack Query, react-hook-form + Zod
- **Tooling** — TypeScript 6, oxlint + oxfmt, Vitest with Testing Library and testcontainers
- **Deploy** — Multi-stage Docker, docker-compose for production

## Prerequisites

- Node.js 24+
- pnpm 11 (managed by [Corepack](https://nodejs.org/api/corepack.html), which ships with Node — run `corepack enable` once)
- Docker (for the local Postgres + integration tests)

## Quick start

```bash
# 1. Enable pnpm via Corepack (one-time, system-wide)
corepack enable

# 2. Install
pnpm install

# 3. Configure env
cp .env.example .env
# Generate the two required secrets:
#   openssl rand -base64 32   → BETTER_AUTH_SECRET
#   openssl rand -hex 32      → ENCRYPTION_KEY

# 4. Start Postgres
docker compose up -d

# 5. Build once so the web typechecks against the server's AppType declaration
pnpm run build

# 6. Run server (3000) + web (5173) in dev
pnpm run dev
```

The dev web server proxies `/api/*` to the API, so everything stays same-origin.

## Layout

```
apps/
  server/    Hono API, scheduler, WhatsApp connection manager
  web/       React SPA — served by the API in production
packages/
  shared/    Zod schemas + enums shared by both apps (source-only)
```

## Commands

| Command                            | What it does                                |
| ---------------------------------- | ------------------------------------------- |
| `pnpm run dev`                     | server (tsx watch) + web (vite) in parallel |
| `pnpm run build`                   | tsup bundle + tsc `.d.ts` emit + vite build |
| `pnpm run start`                   | run the production server                   |
| `pnpm run typecheck`               | `tsc --noEmit` across every workspace       |
| `pnpm run test`                    | vitest run across every workspace           |
| `pnpm run lint` / `lint:fix`       | oxlint                                      |
| `pnpm run format` / `format:check` | oxfmt                                       |
| `pnpm run check`                   | typecheck + test + lint + format            |
| `pnpm run db:generate`             | generate a new Drizzle migration            |
| `pnpm run db:migrate`              | apply pending migrations                    |
| `pnpm run db:studio`               | open Drizzle Studio                         |

## Architecture

**Fullstack type safety.** The server emits a declaration for its `AppType` to `apps/server/dist/dts/app-type.d.ts`. The web imports it via `@app/server/app-type` and types its [Hono RPC](https://hono.dev/docs/guides/rpc) client. No codegen, no shared runtime.

**Scheduler.** A single `scheduler-tick` cron (pg-boss, every minute) selects messages whose `nextRunAt <= now()`, enqueues each as a `send-message` job, and advances `nextRunAt` (recurring) or disables the row (one-time). The `send-message` worker delivers via the WhatsApp service and updates the originating `delivery` row. Failed sends are retried with exponential backoff.

**WhatsApp lifecycle.** `whatsappService.connectAll()` runs on boot and opens a Baileys socket for every user with stored credentials. Connections auto-reconnect with capped exponential backoff. Auth state lives in two encrypted tables — one row per Signal key — so each Baileys key update only writes what changed.

**Database.** Drizzle ORM against vanilla Postgres. Migrations live in `apps/server/drizzle/` and are applied on server boot. pg-boss manages its own `pgboss` schema alongside.

## Testing

```bash
pnpm run test
```

- Server integration tests spin up a Postgres container via [testcontainers](https://testcontainers.com/). Baileys, SMTP and the pg-boss worker are mocked in route tests.
- Web tests run under jsdom with `@testing-library/react`.
- Shared package tests cover the Zod contract (including the cron validator).

Docker is required to run the server suite locally; GitHub Actions provides it by default.

## Production deployment

The Docker image bundles the server, the built SPA, and Drizzle migrations. On boot the server applies migrations, starts pg-boss, then reconnects every paired WhatsApp session before accepting requests.

```bash
# Build & push the image (CI handles this automatically on push to main)
docker build -t ghcr.io/your-org/whatsapp-message-scheduler:latest .

# On the host
cp .env.example .env   # fill in secrets, set APP_DOMAIN
docker compose -f docker-compose.prod.yml up -d
```

`docker-compose.prod.yml` is Traefik-friendly (HTTPS via Let's Encrypt) but a plain reverse proxy works too — drop the labels and expose port 3000.

## Security

- WhatsApp credentials and Signal keys are encrypted at rest with AES-256-GCM (`ENCRYPTION_KEY`, 32 bytes).
- Sessions are HTTP-only cookies issued by Better Auth (secure cookies enabled in production).
- The rate limiter trusts `X-Forwarded-For` only when `TRUST_PROXY=true` — enable that exclusively when sitting behind a known reverse proxy.
- Email verification is mandatory before sign-in; password reset uses Better Auth's single-use tokens.

## License

MIT — see [LICENSE](./LICENSE).
