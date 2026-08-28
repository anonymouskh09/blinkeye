#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/recruite.lancerstech.com"
REPO_URL="${REPO_URL:-https://github.com/anonymouskh09/blinkeye.git}"
BRANCH="${BRANCH:-main}"

echo "=== Deploy from GitHub: $REPO_URL ($BRANCH) ==="

if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  if [ -f backend/.env ]; then
    cp backend/.env /tmp/recruite_backend.env.bak
  fi
  git fetch origin
  git reset --hard "origin/$BRANCH"
  if [ -f /tmp/recruite_backend.env.bak ]; then
    cp /tmp/recruite_backend.env.bak backend/.env
  fi
else
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# Preserve production .env if it already exists
if [ ! -f backend/.env ] && [ -f /tmp/recruite_backend.env.bak ]; then
  cp /tmp/recruite_backend.env.bak backend/.env
fi

bash deploy/finish_remote.sh
