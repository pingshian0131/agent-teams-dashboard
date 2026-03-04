#!/bin/sh
set -e

# Install dependencies if node_modules is empty (first run with named volume)
if [ ! -d "node_modules/.package-lock.json" ]; then
  echo "[entrypoint] Installing dependencies..."
  npm ci
fi

exec "$@"
