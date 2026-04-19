#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  NexusERP — VPS Setup Script
#  Tested on: Ubuntu 22.04 LTS
#  Run as root: bash setup-vps.sh
# ═══════════════════════════════════════════════════════════

set -e  # Exit on any error

# ── Colors ────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Config ────────────────────────────────────────────────
APP_DIR="/var/www/nexus-erp"
LOG_DIR="/var/log/nexus-erp"
DOMAIN="app.nexuserp.com"        # CHANGE THIS
NODE_VERSION="20"
APP_USER="nexus"

info "═══════════════════════════════════════"
info " NexusERP VPS Setup — Ubuntu 22.04"
info "═══════════════════════════════════════"

# ── Step 1: System Update ─────────────────────────────────
info "Step 1: Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget git unzip build-essential

# ── Step 2: Create App User ───────────────────────────────
info "Step 2: Creating app user '$APP_USER'..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$APP_USER"
    info "User '$APP_USER' created."
fi

# ── Step 3: Install Node.js ───────────────────────────────
info "Step 3: Installing Node.js $NODE_VERSION..."
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y -qq nodejs
fi
node --version && npm --version
info "Node.js installed: $(node --version)"

# ── Step 4: Install PM2 ───────────────────────────────────
info "Step 4: Installing PM2 process manager..."
npm install -g pm2 --quiet
pm2 --version
info "PM2 installed."

# ── Step 5: Install Nginx ─────────────────────────────────
info "Step 5: Installing Nginx..."
apt-get install -y -qq nginx
systemctl enable nginx
systemctl start nginx
info "Nginx installed and running."

# ── Step 6: Install Certbot (SSL) ────────────────────────
info "Step 6: Installing Certbot for SSL..."
apt-get install -y -qq certbot python3-certbot-nginx
info "Certbot installed."

# ── Step 7: Create directories ────────────────────────────
info "Step 7: Creating app directories..."
mkdir -p "$APP_DIR"
mkdir -p "$LOG_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
info "Directories created."

# ── Step 8: Configure firewall ────────────────────────────
info "Step 8: Configuring UFW firewall..."
apt-get install -y -qq ufw
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
info "Firewall configured."

# ── Step 9: Nginx config ──────────────────────────────────
info "Step 9: Setting up Nginx config..."
if [ -f "deploy/nginx.conf" ]; then
    cp deploy/nginx.conf /etc/nginx/sites-available/nexus-erp
    sed -i "s/app.nexuserp.com/$DOMAIN/g" /etc/nginx/sites-available/nexus-erp
    ln -sf /etc/nginx/sites-available/nexus-erp /etc/nginx/sites-enabled/nexus-erp
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx
    info "Nginx configured."
else
    warning "deploy/nginx.conf not found. Configure Nginx manually."
fi

# ── Step 10: PM2 Startup ──────────────────────────────────
info "Step 10: Configuring PM2 startup..."
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash || true
info "PM2 startup configured."

# ── Final message ─────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN} VPS Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo " Next steps:"
echo " 1. Upload your app:  git clone <your-repo> $APP_DIR"
echo " 2. Install deps:     cd $APP_DIR && npm install"
echo " 3. Set env vars:     cp .env.example .env.production"
echo "                      nano .env.production"
echo " 4. Build app:        npm run build"
echo " 5. Start with PM2:   pm2 start ecosystem.config.js --env production"
echo " 6. Get SSL cert:     certbot --nginx -d $DOMAIN"
echo " 7. Save PM2:         pm2 save"
echo ""
echo " App logs:  tail -f $LOG_DIR/combined.log"
echo " Nginx logs: tail -f /var/log/nginx/error.log"
echo ""
