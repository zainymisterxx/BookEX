#!/usr/bin/env bash
# BookEX Deploy Script
# Called by GitHub Actions CI/CD on each push to main.
# Can also be run manually: bash /var/www/bookex/deploy/deploy.sh
set -euo pipefail

APP_DIR="/var/www/bookex"

echo "▶ Deploying BookEX..."
cd "$APP_DIR"

echo "   Pulling latest code..."
git pull origin main

echo "   Installing dependencies..."
npm ci --frozen-lockfile

echo "   Building Next.js app..."
npm run build

echo "   Restarting services..."
pm2 restart bookex --update-env
pm2 restart bookex-socket --update-env
pm2 restart bookex-media --update-env
pm2 save

echo "✅ Deployed at $(date)"
pm2 status
