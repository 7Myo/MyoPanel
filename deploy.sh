#!/bin/bash
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[>>]${NC} $1"; }
err()  { echo -e "${RED}[ERREUR]${NC} $1"; exit 1; }
info() { echo -e "${BLUE}[..]${NC} $1"; }

echo ""
echo "=============================================="
echo "  Myo's Panel v1.2 - Deploiement automatique"
echo "=============================================="
echo ""

PI_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$PI_IP" ] && PI_IP=$(ip -o -f inet addr show | awk '/scope global/ {print $4}' | head -1 | cut -d/ -f1)
[ -z "$PI_IP" ] && PI_IP="127.0.0.1"

PI_USER="${SUDO_USER:-$USER}"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_DIR="/opt/myos-panel"

JWT_SECRET=$(cat /dev/urandom 2>/dev/null | tr -dc 'a-zA-Z0-9!@#%^&*()_+-=' | head -c 48 || openssl rand -base64 48 2>/dev/null | tr -dc 'a-zA-Z0-9!@#%^&*()_+-=' | head -c 48)

info "Configuration auto-detectee :"
echo "    IP locale    : ${PI_IP}"
echo "    Utilisateur  : ${PI_USER}"
echo "    Source       : ${SOURCE_DIR}"
echo "    Destination  : ${INSTALL_DIR}"
echo ""

if ! grep -q "Raspberry Pi\\|Debian\\|Ubuntu" /etc/os-release 2>/dev/null; then
    warn "Ce script est concu pour Raspberry Pi OS / Debian / Ubuntu."
    read -p "Continuer ? (o/n) " -n 1 -r
    echo
    [[ $REPLY =~ ^[Oo]$ ]] || exit 0
fi

info "Etape 1/7 : Installation des dependances..."

if ! command -v node &> /dev/null; then
    info "  Installation Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    log "  Node.js $(node -v)"
else
    log "  Node.js $(node -v)"
fi

info "  Installation build-essential..."
sudo apt update -qq
sudo apt install -y build-essential python3 curl git
log "  Outils de compilation installes"

if ! command -v pm2 &> /dev/null; then
    info "  Installation PM2..."
    sudo npm install -g pm2
    log "  PM2 $(pm2 -v)"
else
    log "  PM2 $(pm2 -v)"
fi

info "Etape 2/7 : Copie vers ${INSTALL_DIR}..."

sudo mkdir -p "${INSTALL_DIR}"
sudo rm -rf "${INSTALL_DIR}"/* 2>/dev/null || true
sudo cp -r "${SOURCE_DIR}"/* "${INSTALL_DIR}/"
sudo chown -R ${PI_USER}:${PI_USER} "${INSTALL_DIR}"
log "Projet copie dans ${INSTALL_DIR}"

cd "${INSTALL_DIR}"

info "Etape 3/7 : Generation du fichier .env..."

cat > .env << EOF
HOST=0.0.0.0
PORT=3000
PUBLIC_BASE_URL=http://${PI_IP}:3000
LAN_ONLY=true

JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=8h
SESSION_TIMEOUT_MINUTES=480
BCRYPT_ROUNDS=12

DATA_DIR=${INSTALL_DIR}/runtime
BOTS_DIR=${INSTALL_DIR}/runtime/bots
BACKUPS_DIR=${INSTALL_DIR}/runtime/backups
LOGS_DIR=${INSTALL_DIR}/runtime/logs
TEMP_DIR=${INSTALL_DIR}/runtime/tmp
MAX_UPLOAD_MB=250

NPM_BIN=npm
PM2_MAX_MEMORY=350M
EOF

log ".env cree automatiquement"

info "Etape 4/7 : Installation npm (2-5 minutes)..."
npm install
log "Dependances npm installees"

info "Etape 5/7 : Build du frontend React..."
npm run build
sudo chown -R ${PI_USER}:${PI_USER} "${INSTALL_DIR}"
log "Frontend build avec succes"

info "Etape 6/7 : Creation du service systemd..."

NODE_BIN=$(which node 2>/dev/null || echo "/usr/bin/node")
NODE_DIR=$(dirname "${NODE_BIN}")
log "  node detecte : ${NODE_BIN}"

sudo tee /etc/systemd/system/myos-panel.service > /dev/null << SYSTEMD
[Unit]
Description=Myo's Panel LAN
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
Environment=NODE_ENV=production
Environment=PATH=${NODE_DIR}:/usr/local/bin:/usr/bin:/bin
ExecStart=${NODE_BIN} apps/api/src/server.js
Restart=always
RestartSec=5
User=${PI_USER}
Group=${PI_USER}
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SYSTEMD

sudo systemctl daemon-reload
log "Service systemd cree"

info "Etape 7/7 : Firewall et demarrage..."

if command -v ufw &> /dev/null; then
    LAN_SUBNET=$(ip -o -f inet addr show | awk '/scope global/ {print $4}' | head -1 | sed 's/\\.[0-9]*\\//.0\\//')
    if [ -n "$LAN_SUBNET" ]; then
        sudo ufw allow from ${LAN_SUBNET} to any port 3000 proto tcp 2>/dev/null || true
        log "Port 3000 autorise sur le LAN (${LAN_SUBNET})"
    else
        sudo ufw allow 3000/tcp 2>/dev/null || true
        log "Port 3000 autorise"
    fi
fi

sudo systemctl enable --now myos-panel
sleep 3

if sudo systemctl is-active --quiet myos-panel; then
    echo ""
    echo -e "${GREEN}==============================================${NC}"
    echo -e "${GREEN}  DEPLOIEMENT TERMINE AVEC SUCCES !${NC}"
    echo -e "${GREEN}==============================================${NC}"
    echo ""
    echo -e "  PANEL : ${GREEN}http://${PI_IP}:3000${NC}"
    echo ""
    echo -e "  ${YELLOW}Aucun compte n'a ete cree.${NC}"
    echo -e "  ${YELLOW}Au premier acces, choisis ton identifiant${NC}"
    echo -e "  ${YELLOW}et ton mot de passe sur l'ecran de configuration.${NC}"
    echo ""
    echo "  Commandes utiles :"
    echo "    sudo systemctl status myos-panel"
    echo "    sudo systemctl restart myos-panel"
    echo "    sudo journalctl -u myos-panel -f"
    echo ""
else
    err "Le service n'a pas demarre. Verifie : sudo journalctl -u myos-panel -n 50"
fi
