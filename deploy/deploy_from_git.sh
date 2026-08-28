#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/recruite.lancerstech.com"
REPO_URL="${REPO_URL:-https://github.com/anonymouskh09/blinkeye.git}"
BRANCH="${BRANCH:-main}"

echo "=== Deploy from GitHub: $REPO_URL ($BRANCH) ==="

ENV_BACKUP="/tmp/recruite_backend.env.bak"
if [ -f "$APP_DIR/backend/.env" ]; then
  cp "$APP_DIR/backend/.env" "$ENV_BACKUP"
fi

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git reset --hard "origin/$BRANCH"
else
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

if [ -f "$ENV_BACKUP" ]; then
  cp "$ENV_BACKUP" backend/.env
elif [ ! -f backend/.env ]; then
  bash deploy/setup_remote.sh
  exit 0
fi

sed -i 's/\r$//' deploy/*.sh
bash deploy/finish_remote.sh
