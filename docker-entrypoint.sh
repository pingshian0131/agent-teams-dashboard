#!/bin/sh
set -e

# Install dependencies if node_modules is empty (first run with named volume)
if [ ! -f "node_modules/.package-lock.json" ]; then
  echo "[entrypoint] Installing dependencies..."
  npm ci --force
fi

exec "$@"
