# BookEX — Azure Deployment Guide

Full production deployment on **Azure VM** (`20.219.48.78`) with CI/CD auto-deploy on every push to `main`.

---

## Architecture

```
bookex.farya.pk (DNS → 20.219.48.78)
        ↓
    Nginx  (80 → 443 SSL)
        ├── /             → Next.js app      (localhost:3000)
        ├── /socket.io/   → Socket.IO server  (localhost:3001)
        └── /media/       → Media API         (localhost:4010)

PM2 manages all three Node.js processes with auto-restart.
GitHub Actions deploys automatically on every push to main.
```

---

## One-Time Setup (Do This Once When You Wake Up)

### Step 1 — DNS

In your DNS provider (where `farya.pk` is managed), add an **A record**:

| Name     | Type | Value          | TTL |
|----------|------|----------------|-----|
| `bookex` | A    | `20.219.48.78` | 300 |

Wait ~5 minutes. Verify: `nslookup bookex.farya.pk`

---

### Step 2 — GitHub Secrets

Go to: **GitHub → prof-rdx/BookEX → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name          | Value                     |
|----------------------|---------------------------|
| `AZURE_SSH_HOST`     | `20.219.48.78`            |
| `AZURE_SSH_USER`     | `sabih`                   |
| `AZURE_SSH_PASSWORD` | *(your current SSH password)* |

---

### Step 3 — SSH into the server

```bash
ssh sabih@20.219.48.78
```

---

### Step 4 — Clone the repo and create `.env.local`

```bash
# Create app directory
sudo mkdir -p /var/www/bookex
sudo chown $USER:$USER /var/www/bookex

# Clone
git clone https://github.com/prof-rdx/BookEX.git /var/www/bookex

# Create env file from template
cp /var/www/bookex/env.production.example /var/www/bookex/.env.local
nano /var/www/bookex/.env.local
```

**Required values to fill in:**

```env
# Core
MONGODB_URI=mongodb+srv://...                 # your existing MongoDB URI
NEXTAUTH_SECRET=<run: openssl rand -hex 32>
NEXTAUTH_URL=https://bookex.farya.pk
MEDIA_API_SECRET=<run: openssl rand -hex 32>

# Public URLs (same domain for everything now)
NEXT_PUBLIC_APP_URL=https://bookex.farya.pk
NEXT_PUBLIC_SOCKET_URL=https://bookex.farya.pk

# Upload storage
BOOKEX_UPLOAD_ROOT=/var/www/bookex-uploads

# Optional
REDIS_URL=redis://localhost:6379
RESEND_API_KEY=re_...
GOOGLE_GENAI_API_KEY=AIza...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Generate the two secrets:
```bash
openssl rand -hex 32   # for NEXTAUTH_SECRET
openssl rand -hex 32   # for MEDIA_API_SECRET
```

---

### Step 5 — Run the bootstrap script

```bash
bash /var/www/bookex/deploy/bootstrap.sh
```

This automatically:
- Installs Node.js 20, PM2, tsx, Nginx, Certbot
- Configures Nginx to proxy to all three services
- Sets up the firewall (allows 80/443/22, blocks 3000/3001/4010)
- Gets a free Let's Encrypt SSL certificate for bookex.farya.pk
- Builds the app and starts all three PM2 processes
- Registers PM2 to auto-restart on server reboot

**Bootstrap takes ~5 minutes.**

---

### Step 6 — Disconnect from Vercel

1. Go to **Vercel → BookEX project → Settings → General**
2. Delete the project (or just remove the Git integration)

The app now runs entirely on Azure at https://bookex.farya.pk.

---

## How CI/CD Works After Setup

Every `git push` to `main` triggers:

1. GitHub Actions: lint + type check
2. If passing: SSH into Azure VM and run:
   - `git pull origin main`
   - `npm ci`
   - `npm run build`
   - `pm2 restart` all three processes

**Manual deploy trigger:**
GitHub → Actions → "Deploy to Azure" → Run workflow

---

## Day-to-Day Operations

```bash
ssh sabih@20.219.48.78

pm2 status                  # process health
pm2 logs                    # all logs
pm2 logs bookex             # Next.js app only
pm2 logs bookex-socket      # Socket.IO only
pm2 logs bookex-media       # Media API only
pm2 restart all             # restart everything
pm2 restart all --update-env  # after changing .env.local

sudo nginx -t               # test Nginx config
sudo systemctl reload nginx
sudo certbot renew          # renew SSL (also runs automatically via cron)
```

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| Site won't load | `pm2 status` — are all 3 processes online? |
| Build failed in CI | GitHub Actions tab → failed step logs |
| Socket.IO not connecting | `pm2 logs bookex-socket` and `curl http://localhost:3001/socket.io/?EIO=4` |
| 502 Bad Gateway | `pm2 status` — a process crashed; check `pm2 logs` |
| SSL expired | `sudo certbot renew && sudo systemctl reload nginx` |
| Out of memory | `free -h` and `pm2 monit` |

---

## Security Hardening (Do After Setup)

```bash
# Change SSH password
passwd

# Set up SSH key auth (recommended — also update GitHub secret to AZURE_SSH_KEY)
ssh-keygen -t ed25519
# add public key to ~/.ssh/authorized_keys on the server

# Enable automatic security updates
sudo dpkg-reconfigure -plow unattended-upgrades

# Verify firewall is blocking internal ports
sudo ufw status
```
