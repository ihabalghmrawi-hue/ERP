#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  NexusERP — Zero-Downtime Deploy Script
#  Usage: bash deploy/deploy.sh
#  Run from: /var/www/nexus-erp after git pull
# ═══════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

APP_DIR="/var/www/nexus-erp"
BACKUP_DIR="/var/backups/nexus-erp"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

cd "$APP_DIR"

info "═══════════════════════════════════════"
info " NexusERP Deploy — $(date)"
info "═══════════════════════════════════════"

# ── 1. Pull latest code ───────────────────────────────────
info "1. Pulling latest code from git..."
git pull origin main
info "Code updated. Commit: $(git rev-parse --short HEAD)"

# ── 2. Install dependencies ───────────────────────────────
info "2. Installing dependencies..."
npm ci --production=false --silent
info "Dependencies installed."

# ── 3. Build ──────────────────────────────────────────────
info "3. Building Next.js app..."
NODE_ENV=production npm run build
info "Build complete."

# ── 4. Reload PM2 (zero-downtime) ────────────────────────
info "4. Reloading PM2 (zero-downtime)..."
pm2 reload ecosystem.config.js --env production --update-env
info "PM2 reloaded."

# ── 5. Verify ─────────────────────────────────────────────
info "5. Verifying deployment..."
sleep 3
STATUS=$(pm2 list | grep nexus-erp | grep -c "online" || echo "0")
if [ "$STATUS" -gt 0 ]; then
    info "✅ App is running. $(pm2 list | grep nexus-erp)"
else
    echo -e "${RED}[ERROR]${NC} App failed to start! Check logs: pm2 logs nexus-erp"
    exit 1
fi

info "═══════════════════════════════════════"
info " Deploy successful! 🚀"
info "═══════════════════════════════════════"
