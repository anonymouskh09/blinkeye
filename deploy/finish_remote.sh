#!/bin/bash
set -euo pipefail

APP_DIR="/var/www/recruite.lancerstech.com"
DOMAIN="recruite.lancerstech.com"
API_PORT=8015
WEB_PORT=3015

cd "$APP_DIR/backend"
if [ ! -d venv ]; then
  python3 -m venv venv
fi
./venv/bin/pip install -q --upgrade pip
./venv/bin/pip install -q -r requirements.txt
./venv/bin/alembic upgrade head || true
./venv/bin/python -m app.core.seed || true

cat > "$APP_DIR/frontend/.env.local" <<EOF
NEXT_PUBLIC_API_URL=https://$DOMAIN/api
EOF

echo "Building frontend..."
cd "$APP_DIR/frontend"
npm install --legacy-peer-deps
npm run build

cd "$APP_DIR/backend"
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

cat > /etc/nginx/sites-available/recruite.lancerstech.com <<'NGINX'
server {
    listen 80;
    server_name recruite.lancerstech.com;

    client_max_body_size 20M;

    location /api/ {
        proxy_pass http://127.0.0.1:8015/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
    }

    location / {
        proxy_pass http://127.0.0.1:3015;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/recruite.lancerstech.com /etc/nginx/sites-enabled/recruite.lancerstech.com
nginx -t
systemctl reload nginx

pm2 delete recruite-api recruite-web 2>/dev/null || true
pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save

sleep 3
curl -sI http://127.0.0.1:8015/docs | head -2
curl -sI http://127.0.0.1:3015 | head -2

if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect || true
fi

nginx -t && systemctl reload nginx
echo FINISH_OK
pm2 list | grep recruite
