# Whatsapp Message Scheduler

WhatsApp Message Scheduler is a Turborepo + Bun monorepo for scheduling WhatsApp messages through a Hono API and a React dashboard.

## Workspace layout

- `apps/server` – Hono API, Drizzle ORM, scheduler, WhatsApp integration
- `apps/web` – React + Vite dashboard
- `packages/shared` – shared types/utilities

## Requirements

- Bun (workspace/package manager + script runner)
- Docker (optional, for one-command local infra and deploy-like runs)
- PostgreSQL (only if you run without Docker)

## Setup

1. Install dependencies:

```bash
bun install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Ensure `DATABASE_URL` points to your database:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1/whatsapp_scheduler"
```

4. Run migrations:

```bash
bun run db:generate
bun run db:migrate
```

## Local development (Turborepo)

Run both server and web with one command:

```bash
bun run dev
```

Useful variants:

```bash
bun run dev:server
bun run dev:web
```

- API: `http://localhost:3000`
- Web: `http://localhost:5173`

## Build and run

Build all packages with dependency-aware caching:

```bash
bun run build
```

Run production server (serves built web assets):

```bash
bun run start:server
```

## Docker (local + deploy)

### Full local stack (Postgres + app)

```bash
docker compose up --build
```

This runs:

- Postgres on `localhost:5432`
- App on `http://localhost:3000`

### Build and run image directly

```bash
docker build -t whatsapp-scheduler .
docker run --rm -p 3000:3000 --env-file .env whatsapp-scheduler
```

## Scripts

- `bun run dev` – Run server + web in Turborepo dev mode
- `bun run dev:server` – Run only server dev
- `bun run dev:web` – Run only web dev
- `bun run build` – Build all workspaces
- `bun run build:server` – Build server and required dependencies
- `bun run build:web` – Build web app
- `bun run start:server` – Start production server
- `bun run db:generate` – Generate Drizzle migrations
- `bun run db:migrate` – Run Drizzle migrations
- `bun run clean` – Remove package build outputs and Turbo cache
- `bun run lint` – Run Oxlint
- `bun run lint:fix` – Apply safe Oxlint fixes
- `bun run format` – Format files with Oxfmt
- `bun run format:check` – Check Oxfmt formatting
- `bun run check` – Run lint + format checks

## Hosting/deploy notes

- The server now supports `WEB_DIST_DIR` (defaults to `../web/dist`), making static asset serving reliable in local and container environments.
- For CI/CD monorepo optimization, use Turborepo filtering/affected builds, for example:

```bash
bunx turbo run build --affected
```

## License

See `LICENSE`.
