# Multi-stage Dockerfile for WhatsApp Message Scheduler
# Builds both web and server, runs server which serves static files

# ============================================
# Stage 1: Base image with dependencies
# ============================================
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ linux-headers

# ============================================
# Stage 2: Install dependencies
# ============================================
FROM base AS deps

# Copy workspace configuration
COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies
RUN bun install --frozen-lockfile

# ============================================
# Stage 3: Build the application
# ============================================
FROM base AS builder

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules

# Copy source code
COPY . .

# Build shared package first
WORKDIR /app/packages/shared
RUN bun run build

# Build web app
WORKDIR /app/apps/web
RUN bun run build

# Build server
WORKDIR /app/apps/server
RUN bun run build

# ============================================
# Stage 4: Production image
# ============================================
FROM oven/bun:1-alpine AS production
WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache python3 make g++ linux-headers

# Copy package files for production install
COPY package.json bun.lock ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN bun install --frozen-lockfile --production

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/src ./packages/shared/src
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Copy Drizzle migrations
COPY apps/server/drizzle ./apps/server/drizzle
COPY apps/server/drizzle.config.ts ./apps/server/

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the server
WORKDIR /app/apps/server
CMD ["bun", "run", "start"]
