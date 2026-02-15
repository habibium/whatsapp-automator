# Whatsapp Message Scheduler

WhatsApp Message Scheduler is a small monorepo that lets you schedule WhatsApp messages through a backend service with a React-based dashboard.

The project is split into:

- `apps/server` – Hono-based HTTP API using Drizzle ORM, Postgres, `node-cron`, and Baileys for WhatsApp connectivity.
- `apps/web` – React + Vite frontend dashboard for authentication, connecting WhatsApp, and managing scheduled messages.
- `packages/shared` – Shared types and utilities used by both the server and the web app.

## Tech stack

- **Runtime/Tooling**: Node.js \(\>= 24\), TypeScript, pnpm workspaces
- **Backend**: Hono, `@hono/node-server`, Drizzle ORM + Postgres, `node-cron`, Baileys, `@node-rs/argon2`, Pino
- **Frontend**: React, React Router, Vite

## Getting started

You can run this project either with **Docker** (recommended for production) or **locally** for development.

---

## Option 1: Docker (Recommended)

### Prerequisites

- **Docker** and **Docker Compose** installed

### Quick Start

1. **Clone and configure**:

```bash
cp .env.example .env
# Edit .env to set POSTGRES_PASSWORD for production
```

2. **Build and run**:

```bash
docker compose up -d
```

3. **Run database migrations**:

```bash
docker compose exec app sh -c "cd /app/apps/server && bun run db:migrate"
```

4. **Access the application** at `http://localhost:3000`

### Docker Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down

# Rebuild after code changes
docker compose up -d --build

# Run migrations
docker compose exec app sh -c "cd /app/apps/server && bun run db:migrate"
```

### Development with Docker

For development with hot reloading:

```bash
bun run dev
```

This command uses `.env.dev` by default.

This runs:
- PostgreSQL on port 5432
- Server (with hot reload) on port 3000
- Web frontend (with hot reload) on port 5174

---

## Option 2: Local Development

### 1. Prerequisites

- **Bun** \(\>= 1.0\) or **Node.js** \(\>= 24\)
- **Postgres** running locally or accessible via `DATABASE_URL`

### 2. Install dependencies

From the repository root:

```bash
bun install
```

### 3. Configure environment

Copy `.env.example` and adjust as needed:

```bash
cp .env.example .env
```

The main variable is:

- `DATABASE_URL` – Postgres connection string \(e.g. `postgresql://postgres:postgres@127.0.0.1/whatsapp_scheduler`\)

Depending on how you extend the project, you may add more environment variables (e.g. auth secrets, WhatsApp-related settings) to your `.env`.

### 4. Set up the database

Generate & run migrations from the root (delegated to `apps/server`):

```bash
bun run db:generate
bun run db:migrate
```

Make sure your Postgres instance is running and matches the `DATABASE_URL`.

## Running the apps locally

### Backend server (API)

From the root:

```bash
bun run dev:local
```

This starts the server defined in `apps/server`. It exposes HTTP routes for:

- authentication
- WhatsApp session handling
- scheduling and managing messages

### Web dashboard

In a separate terminal, from the root:

```bash
bun run dev:web
```

This runs the Vite dev server for the React app in `apps/web`. Open the printed URL in your browser (often `http://localhost:5173`) to access the dashboard.

## Project structure

High-level layout:

```text
apps/
  server/   # Hono + Drizzle + Postgres API
  web/      # React + Vite dashboard
packages/
  shared/   # Shared types and utilities
```

Key server folders:

- `src/db` – Drizzle ORM schema and query helpers
- `src/routes` – API routes (auth, messages, WhatsApp)
- `src/services` – Scheduling and WhatsApp integration logic

Key web folders:

- `src/pages` – Top-level pages (login, register, dashboard, message form/list, connect page)
- `src/components` – Layout, footer, protected route wrapper, etc.
- `src/hooks` – Custom hooks for auth, messages, and WhatsApp interactions
- `src/lib/api.ts` – API client helpers

## Scripts (root)

- `bun run dev` – Start the backend server (`apps/server`)
- `bun run dev:web` – Start the web dashboard (`apps/web`)
- `bun run build` – Build all workspaces
- `bun run build:server` – Build the server only
- `bun run build:web` – Build the web app only
- `bun run db:generate` – Generate Drizzle migrations
- `bun run db:migrate` – Run database migrations
- `bun run biome` – Run Biome checks

## Contributing / Development notes

- Keep database changes in sync with `drizzle` migrations in `apps/server`.
- Shared logic (types, logging, etc.) should live in `packages/shared` so both apps can consume it.
- Run `pnpm biome` before committing to keep the codebase consistent.

## License

This project is licensed under the terms described in `LICENSE`.
