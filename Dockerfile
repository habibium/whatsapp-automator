FROM oven/bun:1.2.22 AS builder

WORKDIR /app

COPY package.json bun.lock tsconfig.base.json tsconfig.json .oxlintrc.json .oxfmtrc.json ./
COPY apps ./apps
COPY packages ./packages

RUN bun install --frozen-lockfile
RUN bun run build

FROM oven/bun:1.2.22 AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV WEB_DIST_DIR=/app/apps/web/dist

COPY --from=builder /app/package.json /app/bun.lock ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/turbo.json ./turbo.json
COPY --from=builder /app/apps/server ./apps/server
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/shared ./packages/shared

EXPOSE 3000

CMD ["bun", "run", "start:server"]
