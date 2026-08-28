#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/recruite.lancerstech.com"
DOMAIN="recruite.lancerstech.com"
API_PORT=8015
WEB_PORT=3015
DB_NAME="recruitment_db"
DB_USER="recruit_app"
DB_PASS="${DB_PASS:-RecruitDb2026Secure!}"
JWT_SECRET="${JWT_SECRET:-recruit-jwt-$(openssl rand -hex 24)}"

echo "=== RecruitPro deploy on $DOMAIN ==="

apt-get update -qq
apt-get install -y -qq python3-venv python3-pip postgresql-client >/dev/null 2>&1 || true

mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Extract uploaded archive if present
if [ -f /tmp/recruitment_deploy.tar.gz ]; then
  echo "Extracting application..."
  tar -xzf /tmp/recruitment_deploy.tar.gz -C "$APP_DIR"
  rm -f /tmp/recruitment_deploy.tar.gz
fi

# PostgreSQL database
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" >/dev/null

# Backend env
cat > "$APP_DIR/backend/.env" <<EOF
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME
JWT_SECRET=$JWT_SECRET
JWT_EXPIRE_MINUTES=1440
UPLOAD_DIR=$APP_DIR/backend/app/uploads
CORS_ORIGINS=https://$DOMAIN
ADMIN_EMAIL=admin@agency.com
ADMIN_PASSWORD=Admin123!
ENVIRONMENT=production
FRONTEND_URL=https://$DOMAIN
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://$DOMAIN/api/gmail/callback
TOKEN_ENCRYPTION_KEY=
OUTREACH_DAILY_EMAIL_LIMIT=30
EXTENSION_ALLOW_DEV_TOKEN=false
EOF

mkdir -p "$APP_DIR/backend/app/uploads"

echo "Setting up Python venv..."
cd "$APP_DIR/backend"
python3 -m venv venv
./venv/bin/pip install -q --upgrade pip
./venv/bin/pip install -q -r requirements.txt

echo "Running migrations..."
./venv/bin/alembic upgrade head
./venv/bin/python -m app.core.seed || true

# Frontend env
cat > "$APP_DIR/frontend/.env.local" <<EOF
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
EOF

echo "Building frontend (this may take a few minutes)..."
cd "$APP_DIR/frontend"
npm install --legacy-peer-deps
npm run build

# PM2 ecosystem
cat > "$APP_DIR/ecosystem.config.cjs" <<EOF
module.exports = {
  apps: [
    {
      name: "recruite-api",
      cwd: "$APP_DIR/backend",
      script: "$APP_DIR/backend/venv/bin/uvicorn",
      args: "main:app --host 127.0.0.1 --port $API_PORT",
      interpreter: "none",
      max_restarts: 10,
    },
    {
      name: "recruite-web",
      cwd: "$APP_DIR/frontend",
      script: "npm",
      args: "start -- -p $WEB_PORT -H 127.0.0.1",
      interpreter: "none",
      env: { NODE_ENV: "production", PORT: "$WEB_PORT" },
      max_restarts: 10,
    },
  ],
};
EOF

# Nginx
cat > /etc/nginx/sites-available/recruite.lancerstech.com <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://127.0.0.1:$API_PORT/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Cookie \$http_cookie;
    }

    location / {
        proxy_pass http://127.0.0.1:$WEB_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/recruite.lancerstech.com /etc/nginx/sites-enabled/recruite.lancerstech.com
nginx -t
systemctl reload nginx

# PM2 start/restart
pm2 delete recruite-api recruite-web 2>/dev/null || true
pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save

# SSL
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || true
fi

nginx -t && systemctl reload nginx

echo ""
echo "=== DEPLOY COMPLETE ==="
echo "URL: https://$DOMAIN"
echo "Admin: admin@agency.com / Admin123!"
echo "API port: $API_PORT | Web port: $WEB_PORT"
pm2 list | grep recruite || true
