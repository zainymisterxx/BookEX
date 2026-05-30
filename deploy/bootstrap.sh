#!/usr/bin/env bash
# BookEX Azure Bootstrap Script
# Run ONCE on a fresh Azure Ubuntu VM as the sabih user.
# Usage: bash /var/www/bookex/deploy/bootstrap.sh
set -euo pipefail

APP_DIR="/var/www/bookex"
REPO_URL="https://github.com/sabih-haider1/BookEX.git"
DOMAIN="bookex.farya.pk"
CERTBOT_EMAIL="ahmednaeemx@gmail.com"
UPLOAD_ROOT="/var/www/bookex-uploads"

echo ""
echo "═══════════════════════════════════════════"
echo "  BookEX Bootstrap — Azure Ubuntu Server"
echo "═══════════════════════════════════════════"
echo ""

# ── 1. System packages ──────────────────────────────────────────────────────
echo "▶ [1/9] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y curl git nginx certbot python3-certbot-nginx ufw

# ── 2. Node.js 20 via NodeSource ─────────────────────────────────────────────
echo "▶ [2/9] Installing Node.js 20..."
if ! node --version 2>/dev/null | grep -q "v20"; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "   Node: $(node --version)  NPM: $(npm --version)"

# ── 3. Global npm tools ───────────────────────────────────────────────────────
echo "▶ [3/9] Installing PM2 and tsx globally..."
sudo npm install -g pm2 tsx

# ── 4. Clone repository ──────────────────────────────────────────────────────
echo "▶ [4/9] Setting up application directory..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"

if [ -d "$APP_DIR/.git" ]; then
  echo "   Repo already exists — pulling latest..."
  git -C "$APP_DIR" pull origin main
else
  echo "   Cloning repository..."
  git clone "$REPO_URL" "$APP_DIR"
fi

# ── 5. Upload + log directories ──────────────────────────────────────────────
echo "▶ [5/9] Creating upload and log directories..."
sudo mkdir -p "$UPLOAD_ROOT"/{books,avatars,community,temp}
sudo chown -R "$USER:$USER" "$UPLOAD_ROOT"
sudo mkdir -p /var/log/pm2
sudo chown -R "$USER:$USER" /var/log/pm2

# ── 6. Nginx ─────────────────────────────────────────────────────────────────
echo "▶ [6/9] Configuring Nginx..."
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/bookex
sudo ln -sf /etc/nginx/sites-available/bookex /etc/nginx/sites-enabled/bookex
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

# ── 7. Firewall ──────────────────────────────────────────────────────────────
echo "▶ [7/9] Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Block direct access to internal app ports — Nginx proxies them
sudo ufw deny 3000/tcp
sudo ufw deny 3001/tcp
sudo ufw deny 4010/tcp
sudo ufw --force enable

# ── 8. SSL certificate ────────────────────────────────────────────────────────
echo "▶ [8/9] Obtaining Let's Encrypt certificate..."
# Prerequisite: DNS for $DOMAIN must already point to this server's public IP
sudo certbot --nginx -d "$DOMAIN" \
  --non-interactive --agree-tos -m "$CERTBOT_EMAIL" \
  --redirect

# ── 9. Application + PM2 ─────────────────────────────────────────────────────
echo "▶ [9/9] Installing app dependencies and starting PM2..."

if [ ! -f "$APP_DIR/.env.local" ]; then
  echo ""
  echo "⚠️  .env.local is missing — create it before building:"
  echo ""
  echo "   cp $APP_DIR/env.production.example $APP_DIR/.env.local"
  echo "   nano $APP_DIR/.env.local"
  echo ""
  echo "   Then re-run: bash $APP_DIR/deploy/bootstrap.sh"
  exit 1
fi

cd "$APP_DIR"
npm ci --frozen-lockfile
npm run build

# Register PM2 to start on system reboot
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME"
pm2 start "$APP_DIR/deploy/pm2.config.js"
pm2 save

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Bootstrap complete!"
echo "  🌐 https://$DOMAIN"
echo "═══════════════════════════════════════════"
echo ""
echo "Useful commands:"
echo "  pm2 status           — process health"
echo "  pm2 logs             — tail all logs"
echo "  pm2 restart all      — restart services"
echo "  sudo nginx -t        — test Nginx config"
echo "  sudo certbot renew   — renew SSL cert"
echo ""
