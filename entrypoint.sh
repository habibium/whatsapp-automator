#!/bin/sh
# Run database migrations before starting the server
echo "Running database migrations..."
npx drizzle-kit migrate || echo "Warning: Migrations failed (tables may already exist). Continuing..."

echo "Starting server..."
exec node dist/index.js
