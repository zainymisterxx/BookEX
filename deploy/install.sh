#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║   BookEX — One-Command Installer                         ║
# ║                                                          ║
# ║   SSH in, then run:                                      ║
# ║   curl -fsSL https://raw.githubusercontent.com/prof-rdx/BookEX/main/deploy/install.sh -o ~/install.sh && bash ~/install.sh
# ╚══════════════════════════════════════════════════════════╝
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✔ ${NC}$*"; }
info() { echo -e "${CYAN}  ▶ ${NC}$*"; }
warn() { echo -e "${YELLOW}  ⚠ ${NC}$*"; }
fail() { echo -e "${RED}  ✖ ${NC}$*"; exit 1; }
line() { echo -e "${CYAN}──────────────────────────────────────────────────${NC}"; }

# ── Fixed config ──────────────────────────────────────────────────────────────
DOMAIN="bookex.farya.pk"
APP_DIR="/var/www/bookex"
REPO_URL="https://github.com/prof-rdx/BookEX.git"
CERTBOT_EMAIL="ahmednaeemx@gmail.com"
UPLOAD_ROOT="/var/www/bookex-uploads"

# ── ask/ask_secret: work even when the script is piped from curl ──────────────
ask() {
  local prompt="$1" default="${2:-}" answer
  if [ -n "$default" ]; then
    printf "${BOLD}  %s${NC} [%s]: " "$prompt" "$default" >/dev/tty
  else
    printf "${BOLD}  %s${NC}: " "$prompt" >/dev/tty
  fi
  IFS= read -r answer </dev/tty
  printf '%s' "${answer:-$default}"
}

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║       BookEX — One-Command Azure Installer           ║${NC}"
echo -e "${BOLD}${CYAN}║       Domain : bookex.farya.pk                       ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  What this script does:"
echo "    [1] Installs Node 20, PM2, tsx, Nginx, Certbot"
echo "    [2] Clones the BookEX repo"
echo "    [3] Creates .env.local from your answers"
echo "    [4] Builds the Next.js app"
echo "    [5] Configures Nginx + free SSL certificate"
echo "    [6] Starts all 3 services under PM2"
echo "    [7] Registers PM2 to survive reboots"
echo ""
SERVER_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo "this-server-ip")
warn "DNS check: bookex.farya.pk must already point to ${SERVER_IP}"
warn "If it doesn't, SSL will fail (you can re-run certbot after DNS propagates)."
echo ""

# ═════════════════════════════════════════════════════════════════════════════
echo -e "${BOLD}${CYAN}[ STEP 1/6 ] Collect secrets${NC}"
line
echo "  I only ask for what I can't generate. Press Enter to skip optional ones."
echo ""

MONGODB_URI=$(ask "MongoDB URI  (mongodb+srv://...)")
[ -z "$MONGODB_URI" ] && fail "MongoDB URI is required."

NEXTAUTH_SECRET=$(openssl rand -hex 32)
MEDIA_API_SECRET=$(openssl rand -hex 32)
ok "NEXTAUTH_SECRET auto-generated"
ok "MEDIA_API_SECRET auto-generated"
echo ""

RESEND_API_KEY=$(ask "Resend API key  (re_... — skip to disable email notifications)" "")
GEMINI_API_KEY=$(ask "Gemini API key  (AIza... — skip to disable AI features)" "")
GOOGLE_CLIENT_ID=$(ask "Google OAuth Client ID  (skip to disable Google login)" "")
GOOGLE_CLIENT_SECRET=""
if [ -n "$GOOGLE_CLIENT_ID" ]; then
  GOOGLE_CLIENT_SECRET=$(ask "Google OAuth Client Secret" "")
fi
REDIS_URL=$(ask "Redis URL  (redis://... — skip to disable caching)" "")

echo ""
ok "All inputs collected."

# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${CYAN}[ STEP 2/6 ] System packages${NC}"
line

info "apt update..."
sudo apt-get update -qq

info "Installing git, nginx, certbot, ufw..."
sudo apt-get install -y curl git nginx certbot python3-certbot-nginx ufw -qq

if node --version 2>/dev/null | grep -q "^v20"; then
  ok "Node.js already at $(node --version)"
else
  info "Installing Node.js 20 via NodeSource..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -y nodejs -qq
  ok "Node.js $(node --version) installed"
fi

info "Installing PM2 and tsx globally..."
sudo npm install -g pm2 tsx --silent >/dev/null 2>&1
ok "PM2 $(pm2 --version) ready"

# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${CYAN}[ STEP 3/6 ] Clone repo + write .env.local${NC}"
line

sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"
sudo mkdir -p "$UPLOAD_ROOT"/{books,avatars,community,temp}
sudo chown -R "$USER:$USER" "$UPLOAD_ROOT"
sudo mkdir -p /var/log/pm2
sudo chown -R "$USER:$USER" /var/log/pm2

if [ -d "$APP_DIR/.git" ]; then
  info "Repo already exists — pulling latest from main..."
  git -C "$APP_DIR" fetch origin -q
  git -C "$APP_DIR" checkout main -q 2>/dev/null || true
  git -C "$APP_DIR" pull origin main -q
else
  info "Cloning repository..."
  git clone "$REPO_URL" "$APP_DIR" -q
fi
ok "Repository ready at $APP_DIR"

info "Writing .env.local..."
cat > "$APP_DIR/.env.local" <<ENVEOF
# BookEX Production Environment
# Generated by install.sh — edit manually if needed

MONGODB_URI=${MONGODB_URI}

NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=https://${DOMAIN}
MEDIA_API_SECRET=${MEDIA_API_SECRET}

NEXT_PUBLIC_APP_URL=https://${DOMAIN}
NEXT_PUBLIC_SOCKET_URL=https://${DOMAIN}

BOOKEX_UPLOAD_ROOT=${UPLOAD_ROOT}

RESEND_API_KEY=${RESEND_API_KEY}
GOOGLE_GENAI_API_KEY=${GEMINI_API_KEY}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
REDIS_URL=${REDIS_URL}

SOCKET_PORT=3001
MEDIA_PORT=4010
MEDIA_BIND_HOST=127.0.0.1
ENVEOF

chmod 600 "$APP_DIR/.env.local"
ok ".env.local written with permissions 600"

# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${CYAN}[ STEP 4/6 ] Build the app${NC}"
line

cd "$APP_DIR"
info "npm ci..."
npm ci --frozen-lockfile --silent
ok "Dependencies installed"

info "Building Next.js (takes ~2 min)..."
npm run build
ok "Build complete"

# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${CYAN}[ STEP 5/6 ] Nginx + SSL${NC}"
line

info "Installing Nginx config..."
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/bookex
sudo ln -sf /etc/nginx/sites-available/bookex /etc/nginx/sites-enabled/bookex
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx -q
sudo systemctl reload nginx
ok "Nginx configured"

info "Configuring firewall (22/80/443 open, 3000/3001/4010 blocked)..."
sudo ufw allow  22/tcp  >/dev/null
sudo ufw allow  80/tcp  >/dev/null
sudo ufw allow 443/tcp  >/dev/null
sudo ufw deny  3000/tcp >/dev/null
sudo ufw deny  3001/tcp >/dev/null
sudo ufw deny  4010/tcp >/dev/null
sudo ufw --force enable >/dev/null
ok "Firewall active"

info "Requesting Let's Encrypt certificate for $DOMAIN ..."
if sudo certbot --nginx -d "$DOMAIN" \
     --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect 2>&1; then
  ok "SSL certificate installed — site is HTTPS"
else
  warn "Certbot failed. Fix DNS, then run:"
  warn "  sudo certbot --nginx -d $DOMAIN --agree-tos -m $CERTBOT_EMAIL"
fi

# ═════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${CYAN}[ STEP 6/6 ] Start services with PM2${NC}"
line

# Clean up any existing processes before starting fresh
pm2 delete all 2>/dev/null || true

pm2 start "$APP_DIR/deploy/pm2.config.js"

info "Registering PM2 as a system service..."
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER" --hp "$HOME" 2>&1 | grep -v "^$" | tail -3
pm2 save
ok "PM2 will auto-start on server reboot"

# ═════════════════════════════════════════════════════════════════════════════
line
echo ""
echo -e "${BOLD}${GREEN}  ✅  BookEX is live!${NC}"
echo ""
echo -e "  🌐  ${BOLD}https://${DOMAIN}${NC}"
echo ""
pm2 status
echo ""
echo -e "${YELLOW}  ── Next steps (do these once) ──${NC}"
echo ""
echo "  1. Add these 3 GitHub Secrets so every git push auto-deploys:"
echo "     Go to: github.com/prof-rdx/BookEX → Settings → Secrets → Actions"
echo ""
echo "     AZURE_SSH_HOST     = ${SERVER_IP}"
echo "     AZURE_SSH_USER     = ${USER}"
echo "     AZURE_SSH_PASSWORD = <your SSH password>"
echo ""
echo "  2. Merge  feat/full-audit-qa-fixes  →  main  on GitHub."
echo "     After that: every git push triggers an auto-deploy."
echo ""
echo "  3. Harden SSH (recommended):"
echo "     passwd                  — change your password"
echo ""
echo "  Useful commands:"
echo "    pm2 logs                 — tail all logs"
echo "    pm2 logs bookex          — Next.js only"
echo "    pm2 logs bookex-socket   — Socket.IO only"
echo "    pm2 restart all          — restart everything"
echo "    pm2 monit                — live CPU / RAM"
echo "    nano $APP_DIR/.env.local — edit env vars"
echo "    pm2 restart all --update-env   — apply env changes"
echo ""
line
