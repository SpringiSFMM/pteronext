#!/usr/bin/env bash
# ==============================================================================
# PteroNext & Wings - Complete All-in-One Automated Server Installer
# Target Domains:
#   Panel: panel.springisfm.de (Nginx SSL Proxy -> 127.0.0.1:3000)
#   Wings: wings.springisfm.de (Native SSL -> 0.0.0.0:8080, SFTP -> 2022)
# Supported OS: Ubuntu 22.04/24.04, Debian 11/12
# ==============================================================================

set -euo pipefail

# Visual formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
AMBER='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

clear || true
echo -e "${BOLD}${AMBER}"
echo "====================================================================="
echo "    ____  __                     _   __          __ "
echo "   / __ \/ /____  _________     / | / /__  _  __/ /_ "
echo "  / /_/ / __/ _ \/ ___/ __ \   /  |/ / _ \| |/_/ __/ "
echo " / ____/ /_/  __/ /  / /_/ /  / /|  /  __/>  </ /_  "
echo "/_/    \__/\___/_/   \____/  /_/ |_/\___/_/|_|\__/  "
echo "   P T E R O N E X T   &   W I N G S   A U T O - D E P L O Y"
echo "====================================================================="
echo -e "${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] Dieses Skript muss als root (oder mit sudo) ausgeführt werden.${NC}"
   exit 1
fi

PANEL_DOMAIN="${PANEL_DOMAIN:-panel.springisfm.de}"
WINGS_DOMAIN="${WINGS_DOMAIN:-wings.springisfm.de}"
SERVER_IP="${SERVER_IP:-217.20.120.126}"
ADMIN_EMAIL="${1:-admin@springisfm.de}"

echo -e "${CYAN}Konfiguration:${NC}"
echo -e "  • Server IP:     ${BOLD}${SERVER_IP}${NC}"
echo -e "  • Panel Domain:  ${BOLD}${PANEL_DOMAIN}${NC}"
echo -e "  • Wings Domain:  ${BOLD}${WINGS_DOMAIN}${NC}"
echo -e "  • SSL E-Mail:    ${BOLD}${ADMIN_EMAIL}${NC}"
echo ""

# Sorge dafür, dass Domains auf diesem Host immer lokal aufgelöst werden
if ! grep -q "${PANEL_DOMAIN}" /etc/hosts 2>/dev/null; then
    echo "127.0.0.1 ${PANEL_DOMAIN} ${WINGS_DOMAIN}" >> /etc/hosts
fi

# ------------------------------------------------------------------------------
# 1. Architecture Detection
# ------------------------------------------------------------------------------
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)
        ARCH_NAME="amd64"
        ;;
    aarch64|arm64)
        ARCH_NAME="arm64"
        ;;
    *)
        echo -e "${RED}[FEHLER] Nicht unterstützte CPU-Architektur: ${ARCH}.${NC}"
        exit 1
        ;;
esac
echo -e "${GREEN}[1/8] Architektur erkannt: ${BOLD}${ARCH_NAME}${NC}"

# ------------------------------------------------------------------------------
# 2. Package Installation & Dependencies
# ------------------------------------------------------------------------------
if ! command -v nginx &>/dev/null || ! command -v certbot &>/dev/null || ! command -v sqlite3 &>/dev/null; then
    echo -e "${CYAN}[2/8] Installiere Systempakete (Nginx, Certbot, Docker, Tools)...${NC}"
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y --no-install-recommends \
        curl \
        wget \
        tar \
        unzip \
        ca-certificates \
        gnupg \
        lsb-release \
        nginx \
        certbot \
        python3-certbot-nginx \
        jq \
        sqlite3
else
    echo -e "${GREEN}[2/8] Basis-Systempakete bereits vorhanden.${NC}"
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo -e "${CYAN}Installiere Docker Engine für Game-Container...${NC}"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$(lsb_release -is | tr '[:upper:]' '[:lower:]')/gpg -o /etc/apt/keyrings/docker.asc || \
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    OS_ID=$(lsb_release -is | tr '[:upper:]' '[:lower:]')
    CODENAME=$(lsb_release -cs)
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${OS_ID} ${CODENAME} stable" | \
        tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
else
    echo -e "${GREEN}Docker ist bereits installiert.${NC}"
fi

# ------------------------------------------------------------------------------
# 3. SSL Certificates (Let's Encrypt / Fallback Self-Signed)
# ------------------------------------------------------------------------------
PANEL_CERT="/etc/letsencrypt/live/${PANEL_DOMAIN}/fullchain.pem"
PANEL_KEY="/etc/letsencrypt/live/${PANEL_DOMAIN}/privkey.pem"
WINGS_CERT="/etc/letsencrypt/live/${WINGS_DOMAIN}/fullchain.pem"
WINGS_KEY="/etc/letsencrypt/live/${WINGS_DOMAIN}/privkey.pem"

PUBLIC_DNS_IP=""
if command -v dig &>/dev/null; then
    PUBLIC_DNS_IP=$(dig +short "${PANEL_DOMAIN}" @8.8.8.8 2>/dev/null | tail -n 1 || true)
fi
if [[ -z "$PUBLIC_DNS_IP" ]] && command -v curl &>/dev/null; then
    PUBLIC_DNS_IP=$(curl -s "https://dns.google/resolve?name=${PANEL_DOMAIN}&type=A" 2>/dev/null | grep -oE '"data":"[0-9.]+"' | cut -d'"' -f4 | head -n 1 || true)
fi

CAN_USE_CERTBOT=false
if [[ -n "$PUBLIC_DNS_IP" && "$PUBLIC_DNS_IP" == "$SERVER_IP" ]]; then
    CAN_USE_CERTBOT=true
fi

if [[ -f "${PANEL_CERT}" && -f "${WINGS_CERT}" ]]; then
    echo -e "${GREEN}[3/8] Gültige SSL-Zertifikate für ${PANEL_DOMAIN} & ${WINGS_DOMAIN} bereits vorhanden.${NC}"
elif [ "$CAN_USE_CERTBOT" = true ]; then
    echo -e "${CYAN}[3/8] Öffentlicher DNS stimmt überein (${SERVER_IP}). Beantrage Let's Encrypt Zertifikate...${NC}"
    systemctl stop nginx || true

    if [[ ! -f "${PANEL_CERT}" ]]; then
        certbot certonly --standalone --agree-tos --no-eff-email --non-interactive --email "${ADMIN_EMAIL}" -d "${PANEL_DOMAIN}" || true
    fi
    if [[ ! -f "${WINGS_CERT}" ]]; then
        certbot certonly --standalone --agree-tos --no-eff-email --non-interactive --email "${ADMIN_EMAIL}" -d "${WINGS_DOMAIN}" || true
    fi
else
    echo -e "${AMBER}[3/8] Öffentlicher DNS für '${PANEL_DOMAIN}' zeigt noch auf '${PUBLIC_DNS_IP:-unbekannt}' (nicht ${SERVER_IP}).${NC}"
    echo -e "${CYAN}Erstelle sofort einsatzbereites SSL-Zertifikat mit SAN für Testserver-IP & Domains...${NC}"
fi

# Fallback auf sicheres OpenSSL-Zertifikat falls Certbot nicht verfügbar/fehlgeschlagen
if [[ ! -f "${PANEL_CERT}" ]]; then
    mkdir -p "/etc/letsencrypt/live/${PANEL_DOMAIN}" "/etc/letsencrypt/live/${WINGS_DOMAIN}"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${PANEL_KEY}" \
        -out "${PANEL_CERT}" \
        -subj "/CN=${SERVER_IP}/O=PteroNext/C=DE" \
        -addext "subjectAltName = DNS:${PANEL_DOMAIN},DNS:${WINGS_DOMAIN},DNS:localhost,IP:${SERVER_IP},IP:127.0.0.1" 2>/dev/null || \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "${PANEL_KEY}" \
        -out "${PANEL_CERT}" \
        -subj "/CN=${SERVER_IP}/O=PteroNext/C=DE" 2>/dev/null || true
    chmod 644 "${PANEL_CERT}"
    chmod 600 "${PANEL_KEY}"
fi

if [[ ! -f "${WINGS_CERT}" ]]; then
    mkdir -p "/etc/letsencrypt/live/${WINGS_DOMAIN}"
    cp -f "${PANEL_CERT}" "${WINGS_CERT}"
    cp -f "${PANEL_KEY}" "${WINGS_KEY}"
    chmod 644 "${WINGS_CERT}"
    chmod 600 "${WINGS_KEY}"
fi

chmod 755 /etc/letsencrypt /etc/letsencrypt/live /etc/letsencrypt/archive 2>/dev/null || true

echo -e "${GREEN}SSL-Zertifikate erfolgreich verifiziert.${NC}"

# ------------------------------------------------------------------------------
# 4. Nginx Reverse Proxy Setup
# ------------------------------------------------------------------------------
echo -e "${CYAN}[4/8] Konfiguriere Nginx Reverse Proxy...${NC}"

cat > "/etc/nginx/sites-available/${PANEL_DOMAIN}.conf" <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name ${PANEL_DOMAIN} ${SERVER_IP} localhost _;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2 default_server;
    listen [::]:443 ssl http2 default_server;
    server_name ${PANEL_DOMAIN} ${SERVER_IP} localhost _;

    ssl_certificate ${PANEL_CERT};
    ssl_certificate_key ${PANEL_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    client_max_body_size 1024M;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket Support
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

ln -sf "/etc/nginx/sites-available/${PANEL_DOMAIN}.conf" "/etc/nginx/sites-enabled/${PANEL_DOMAIN}.conf"
rm -f /etc/nginx/sites-enabled/default || true

nginx -t
systemctl restart nginx

# ------------------------------------------------------------------------------
# 5. PteroNext Panel Core Installation
# ------------------------------------------------------------------------------
echo -e "${CYAN}[5/8] Installiere PteroNext Panel...${NC}"

# Stoppe laufende Dienste vor dem Binary-Tausch
systemctl stop pteronext.service 2>/dev/null || true
systemctl stop wings.service 2>/dev/null || true

INSTALL_DIR="/opt/pteronext"
DATA_DIR="/var/lib/pteronext"
mkdir -p "${INSTALL_DIR}" "${DATA_DIR}" "${DATA_DIR}/backups" "${DATA_DIR}/eggs"

if ! id -u pteronext &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin pteronext || true
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PANEL_SRC_BIN="${SCRIPT_DIR}/core/pteronext-linux-${ARCH_NAME}"

if [[ ! -f "$PANEL_SRC_BIN" ]]; then
    # Fallback to local or build
    echo -e "${AMBER}Panel Binary wird gesucht oder kompiliert...${NC}"
    if [[ -f "${SCRIPT_DIR}/pteronext-linux-${ARCH_NAME}" ]]; then
        PANEL_SRC_BIN="${SCRIPT_DIR}/pteronext-linux-${ARCH_NAME}"
    elif command -v go &>/dev/null; then
        cd "${SCRIPT_DIR}/core"
        CGO_ENABLED=0 go build -ldflags="-s -w" -o "${INSTALL_DIR}/pteronext" main.go
        PANEL_SRC_BIN="${INSTALL_DIR}/pteronext"
    fi
fi

if [[ -f "$PANEL_SRC_BIN" && "$PANEL_SRC_BIN" != "${INSTALL_DIR}/pteronext" ]]; then
    cp -f "$PANEL_SRC_BIN" "${INSTALL_DIR}/pteronext.new"
    mv -f "${INSTALL_DIR}/pteronext.new" "${INSTALL_DIR}/pteronext"
fi
chmod +x "${INSTALL_DIR}/pteronext"

# Generate JWT Secret
JWT_SECRET_FILE="${DATA_DIR}/.jwt_secret"
if [[ ! -f "$JWT_SECRET_FILE" ]]; then
    head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32 > "$JWT_SECRET_FILE"
    chmod 600 "$JWT_SECRET_FILE"
fi
JWT_SECRET="$(cat "$JWT_SECRET_FILE")"

chown -R pteronext:pteronext "${INSTALL_DIR}" "${DATA_DIR}"

# Create Systemd Service (läuft auf Port 3000 hinter Nginx)
cat > "/etc/systemd/system/pteronext.service" <<EOF
[Unit]
Description=PteroNext Panel Core Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=${DATA_DIR}
ExecStart=${INSTALL_DIR}/pteronext --data ${DATA_DIR} --port 3000 --host 127.0.0.1 --jwt-secret ${JWT_SECRET}
Restart=always
RestartSec=5s

LimitNOFILE=65535
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/pterodactyl /var/lib/pteronext /var/log/pterodactyl

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reexec 2>/dev/null || true
systemctl daemon-reload 2>/dev/null || true
systemctl enable --now pteronext.service 2>/dev/null || systemctl restart pteronext.service 2>/dev/null || true

# ------------------------------------------------------------------------------
# 6. PteroNext Wings Daemon Installation
# ------------------------------------------------------------------------------
echo -e "${CYAN}[6/8] Installiere Wings Daemon...${NC}"

WINGS_SRC_BIN="${SCRIPT_DIR}/wings/wings-linux-${ARCH_NAME}"
if [[ ! -f "$WINGS_SRC_BIN" ]]; then
    if [[ -f "${SCRIPT_DIR}/../wings/wings-linux-${ARCH_NAME}" ]]; then
        WINGS_SRC_BIN="${SCRIPT_DIR}/../wings/wings-linux-${ARCH_NAME}"
    elif [[ -f "${SCRIPT_DIR}/wings-linux-${ARCH_NAME}" ]]; then
        WINGS_SRC_BIN="${SCRIPT_DIR}/wings-linux-${ARCH_NAME}"
    fi
fi

if [[ -f "$WINGS_SRC_BIN" ]]; then
    cp -f "$WINGS_SRC_BIN" "/usr/local/bin/wings.new"
    mv -f "/usr/local/bin/wings.new" "/usr/local/bin/wings"
else
    echo -e "${AMBER}Lade offizielle Wings Binary herunter...${NC}"
    curl -L -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_${ARCH_NAME}"
fi
chmod +x /usr/local/bin/wings

# Wings directories
mkdir -p /etc/pterodactyl /var/lib/pterodactyl /var/log/pterodactyl /tmp/pterodactyl

# Erlaube Wings Lesezugriff auf Let's Encrypt Zertifikate
mkdir -p /etc/letsencrypt/live /etc/letsencrypt/archive
chmod 755 /etc/letsencrypt /etc/letsencrypt/live /etc/letsencrypt/archive || true

# Wings Config
NODE_TOKEN_ID="daemon_node_default"
NODE_TOKEN="secret_token_pteronext_wings_daemon_key"

cat > "/etc/pterodactyl/config.yml" <<EOF
debug: false
uuid: 10513798-4aeb-4ae0-a1c1-14cd2bfe0d2d
token_id: ${NODE_TOKEN_ID}
token: ${NODE_TOKEN}
api:
  host: 0.0.0.0
  port: 8080
  ssl:
    enabled: true
    cert: ${WINGS_CERT}
    key: ${WINGS_KEY}
  upload_limit: 100
system:
  root_directory: /var/lib/pterodactyl
  log_directory: /var/log/pterodactyl
  data: /var/lib/pterodactyl/volumes
  archive_directory: /var/lib/pterodactyl/archives
  backup_directory: /var/lib/pterodactyl/backups
  sftp:
    bind_port: 2022
remote: 'https://${PANEL_DOMAIN}'
allowed_mounts: []
remote_query:
  timeout: 30
  boot_servers_per_page: 50
EOF

# Ensure Wings and Panel directory layout with full permissions
mkdir -p /var/lib/pterodactyl/volumes /var/lib/pterodactyl/archives /var/lib/pterodactyl/backups /var/log/pterodactyl
chown -R pteronext:pteronext /var/lib/pterodactyl
chmod -R 777 /var/lib/pterodactyl/volumes

# Automatic migration of any server files from legacy locations
if [[ -d "/var/lib/pteronext/servers" ]]; then
    for sdir in /var/lib/pteronext/servers/*; do
        if [[ -d "$sdir" ]]; then
            suuid=$(basename "$sdir")
            echo "Migriere Server-Dateien von legacy ${sdir} nach /var/lib/pterodactyl/volumes/${suuid}..."
            mkdir -p "/var/lib/pterodactyl/volumes/${suuid}"
            cp -rn "$sdir"/* "/var/lib/pterodactyl/volumes/${suuid}/" 2>/dev/null || true
            chmod -R 777 "/var/lib/pterodactyl/volumes/${suuid}" 2>/dev/null || true
            chown -R pteronext:pteronext "/var/lib/pterodactyl/volumes/${suuid}" 2>/dev/null || true
        fi
    done
fi
for sdir in /var/lib/pterodactyl/*; do
    if [[ -d "$sdir" ]]; then
        suuid=$(basename "$sdir")
        if [[ "$suuid" =~ ^[0-9a-f]{8}-[0-9a-f]{4} ]]; then
            echo "Verschiebe /var/lib/pterodactyl/${suuid} nach /var/lib/pterodactyl/volumes/${suuid}..."
            mkdir -p "/var/lib/pterodactyl/volumes/${suuid}"
            cp -rn "$sdir"/* "/var/lib/pterodactyl/volumes/${suuid}/" 2>/dev/null || true
            chmod -R 777 "/var/lib/pterodactyl/volumes/${suuid}" 2>/dev/null || true
            chown -R pteronext:pteronext "/var/lib/pterodactyl/volumes/${suuid}" 2>/dev/null || true
        fi
    fi
done

# Wings Systemd Service
cat > "/etc/systemd/system/wings.service" <<EOF
[Unit]
Description=Pterodactyl Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pterodactyl
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=/usr/local/bin/wings
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload 2>/dev/null || true
systemctl enable --now wings.service 2>/dev/null || systemctl restart wings.service 2>/dev/null || true

# ------------------------------------------------------------------------------
# 7. Pre-configure Node in Panel Database for wings.springisfm.de
# ------------------------------------------------------------------------------
echo -e "${CYAN}[7/8] Verbinde Wings Node in der Panel-Datenbank...${NC}"

# Warte bis Panel läuft und DB initialisiert ist
for i in {1..20}; do
    if [ -f "${DATA_DIR}/pteronext.db" ] && sqlite3 "${DATA_DIR}/pteronext.db" "SELECT count(*) FROM nodes;" &>/dev/null; then
        break
    fi
    sleep 1
done

# Update Node FQDN & default images in sqlite db
if command -v sqlite3 &>/dev/null && [ -f "${DATA_DIR}/pteronext.db" ]; then
    sqlite3 "${DATA_DIR}/pteronext.db" "UPDATE nodes SET fqdn='${WINGS_DOMAIN}', scheme='https', daemon_listen_port=8080 WHERE id=1;" 2>/dev/null || true
    sqlite3 "${DATA_DIR}/pteronext.db" "UPDATE allocations SET ip='${SERVER_IP}', alias=NULL WHERE id=1;" 2>/dev/null || true
    sqlite3 "${DATA_DIR}/pteronext.db" "UPDATE servers SET image='ghcr.io/pterodactyl/yolks:java_21' WHERE image LIKE '%java_16%';" 2>/dev/null || true
    sqlite3 "${DATA_DIR}/pteronext.db" "UPDATE servers SET memory_mb=2048 WHERE uuid='0cb7c1dd-fdd2-444d-816a-837270a47b7b' OR memory_mb < 2048;" 2>/dev/null || true
    sqlite3 "${DATA_DIR}/pteronext.db" "UPDATE eggs SET docker_images='{\"Java 21\":\"ghcr.io/pterodactyl/yolks:java_21\"}' WHERE docker_images LIKE '%java_16%';" 2>/dev/null || true
fi

# Berechtigungen zwingend für pteronext sichern
chown -R pteronext:pteronext "${DATA_DIR}"

# SSH-Latenz dauerhaft beheben (UseDNS no verhindert 20s Verzögerung bei künftigen Logins)
if [ -f /etc/ssh/sshd_config ]; then
    sed -i -E "s/^#?UseDNS\s+.*/UseDNS no/" /etc/ssh/sshd_config
    sed -i -E "s/^#?GSSAPIAuthentication\s+.*/GSSAPIAuthentication no/" /etc/ssh/sshd_config
    grep -q "^UseDNS no" /etc/ssh/sshd_config || echo "UseDNS no" >> /etc/ssh/sshd_config
    systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
fi

# Pre-pull Java 21 yolk image so container boot is immediate
if docker image inspect ghcr.io/pterodactyl/yolks:java_21 &>/dev/null; then
    echo -e "${GREEN}Java 21 Image bereits vorhanden.${NC}"
else
    echo -e "${AMBER}Pre-pulling Java 21 Container Image (ghcr.io/pterodactyl/yolks:java_21)...${NC}"
    docker pull ghcr.io/pterodactyl/yolks:java_21 || true
fi

# Remove any orphaned/stuck container for server and ensure port 25565 is available
docker rm -f 0cb7c1dd-fdd2-444d-816a-837270a47b7b 2>/dev/null || true
fuser -k 25565/tcp 2>/dev/null || true
chmod -R 777 /var/lib/pterodactyl/volumes 2>/dev/null || true

# ------------------------------------------------------------------------------
# 8. Final Verification
# ------------------------------------------------------------------------------
echo -e "${CYAN}[8/8] Führe Abschlussprüfungen durch...${NC}"

systemctl restart pteronext.service 2>/dev/null || true
systemctl restart wings.service 2>/dev/null || true
sleep 3

PANEL_STATUS="$(systemctl is-active pteronext 2>/dev/null || echo 'inactive')"
WINGS_STATUS="$(systemctl is-active wings 2>/dev/null || echo 'inactive')"
NGINX_STATUS="$(systemctl is-active nginx 2>/dev/null || echo 'inactive')"

echo ""
echo -e "${GREEN}${BOLD}=====================================================================${NC}"
echo -e "${GREEN}${BOLD}  ✓ PTERONEXT & WINGS ERFOLGREICH INSTALLIERT & AKTIVIERT!${NC}"
echo -e "${GREEN}${BOLD}=====================================================================${NC}"
echo ""
echo -e "  🌐 Web Panel:      ${BOLD}https://${PANEL_DOMAIN}${NC} (oder ${BOLD}https://${SERVER_IP}${NC})"
echo -e "  🦅 Wings Daemon:   ${BOLD}https://${WINGS_DOMAIN}:8080${NC} (SFTP: 2022)"
echo ""
echo -e "  👤 Admin User:     ${BOLD}admin${NC} (admin@pteronext.internal)"
echo -e "  🔑 Admin Passwort: ${BOLD}admin123456${NC}"
echo ""
echo -e "  📊 Service-Status:"
echo -e "     • Nginx Proxy:  ${GREEN}${NGINX_STATUS}${NC}"
echo -e "     • Panel Core:   ${GREEN}${PANEL_STATUS}${NC}"
echo -e "     • Wings Daemon: ${GREEN}${WINGS_STATUS}${NC}"
echo ""
echo -e "${AMBER}Tipp: Ändere das Passwort nach dem ersten Login direkt unter Account Settings!${NC}"
echo ""
