# Whatsapp Message Scheduler

WhatsApp Message Scheduler is a Bun workspace monorepo for scheduling WhatsApp messages through a backend API and a React dashboard.

## Monorepo layout

- `apps/server` – Hono API, Drizzle ORM, PostgreSQL, scheduler, WhatsApp integration
- `apps/web` – React + Vite dashboard
- `packages/shared` – shared types/utilities

## Requirements

- Bun (for dependency + workspace management)
- Node.js >= 24 (server runtime/build tooling)
- Local PostgreSQL instance

## Setup

1. Install dependencies:

```bash
bun install
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Ensure your `DATABASE_URL` points to local Postgres, for example:

```dotenv
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1/whatsapp_scheduler"
```

4. Run migrations:

```bash
bun run db:generate
bun run db:migrate
```

## Run locally

Run each app in its own terminal:

```bash
# API server
bun run dev:server

# Web app
bun run dev:web
```

- API: `http://localhost:3000`
- Web: `http://localhost:5173`

## Root scripts

- `bun run dev` – Start server dev mode
- `bun run dev:server` – Start server dev mode
- `bun run dev:web` – Start web dev mode
- `bun run build` – Build all workspaces
- `bun run build:server` – Build shared + server
- `bun run build:web` – Build web app
- `bun run db:generate` – Generate Drizzle migrations
- `bun run db:migrate` – Run Drizzle migrations
- `bun run biome` – Run Biome checks

## License

See `LICENSE`.
