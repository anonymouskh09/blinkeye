#!/bin/bash
# Called by GitHub Actions after SSH onto the production host.
set -euo pipefail

APP_DIR="/var/www/recruite.lancerstech.com"
BRANCH="${BRANCH:-main}"

echo "=== CI deploy start: $(date -u +%Y-%m-%dT%H:%M:%SZ) branch=$BRANCH ==="

cd "$APP_DIR"

# Preserve production .env across hard resets
ENV_BACKUP="/tmp/recruite_backend.env.ci.bak"
if [ -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/backend/.env" "$ENV_BACKUP"
fi

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

if [ -f "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" "$APP_DIR/backend/.env"
fi

# Normalize Windows line endings if any
find deploy -name "*.sh" -exec sed -i 's/\r$//' {} +

bash deploy/finish_remote.sh

echo "=== CI deploy finished: $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
