# syntax=docker/dockerfile:1.7
#
# Multi-stage build:
#   1. `builder` — installs deps via pnpm (corepack) and builds server + web
#   2. `runner`  — Node-only runtime image with the built artifacts

# ── Builder ─────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

# Toolchain required by native postinstall scripts (ssh2, sharp, etc.).
RUN apk add --no-cache python3 make g++ libc6-compat \
    && corepack enable

# Cache the install layer separately from source.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# Bring in sources and build every workspace.
COPY . .
RUN pnpm run build

# ── Runner ──────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app/apps/server

ENV NODE_ENV=production \
    PORT=3000 \
    WEB_DIST_DIR=/app/apps/web/dist

# Preserve the workspace layout so pnpm's symlinked deps resolve.
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/apps/server/package.json ./package.json
COPY --from=builder /app/apps/server/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./dist
COPY --from=builder /app/apps/server/drizzle ./drizzle
COPY --from=builder /app/apps/web/dist /app/apps/web/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
