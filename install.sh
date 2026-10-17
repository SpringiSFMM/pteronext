#!/usr/bin/env bash
# ==============================================================================
# PteroNext Panel - Automated Linux Server Installer
# Installs the standalone single-binary PteroNext Panel and configures systemd.
# Supports: Ubuntu, Debian, CentOS, AlmaLinux, RockyLinux, Fedora, Arch Linux
# Architectures: x86_64 (amd64) and aarch64 (arm64)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
AMBER='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${AMBER}"
echo "====================================================================="
echo "    ____  __                     _   __          __ "
echo "   / __ \/ /____  _________     / | / /__  _  __/ /_ "
echo "  / /_/ / __/ _ \/ ___/ __ \   /  |/ / _ \| |/_/ __/ "
echo " / ____/ /_/  __/ /  / /_/ /  / /|  /  __/>  </ /_  "
echo "/_/    \__/\___/_/   \____/  /_/ |_/\___/_/|_|\__/  "
echo "       P T E R O N E X T   S E R V E R   I N S T A L L E R"
echo "====================================================================="
echo -e "${NC}"

# Check for root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This installer must be executed as root (or with sudo).${NC}"
   exit 1
fi

INSTALL_DIR="/opt/pteronext"
DATA_DIR="/var/lib/pteronext"
SERVICE_PATH="/etc/systemd/system/pteronext.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Architecture Detection
ARCH="$(uname -m)"
case "$ARCH" in
    x86_64)
        BINARY_SOURCE="${SCRIPT_DIR}/core/pteronext-linux-amd64"
        ARCH_NAME="amd64"
        ;;
    aarch64|arm64)
        BINARY_SOURCE="${SCRIPT_DIR}/core/pteronext-linux-arm64"
        ARCH_NAME="arm64"
        ;;
    *)
        echo -e "${RED}[ERROR] Unsupported CPU architecture: ${ARCH}.${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}[INFO] Detected Architecture: ${BOLD}${ARCH_NAME}${NC}"

# Resolve or Download PteroNext Single-Binary
DOWNLOAD_URL="https://pteronext.com/dl/pteronext-linux-${ARCH_NAME}"
GITHUB_FALLBACK_URL="https://raw.githubusercontent.com/SpringiSFMM/pteronext/main/core/pteronext-linux-${ARCH_NAME}"
TEMP_BINARY="/tmp/pteronext-linux-${ARCH_NAME}"

if [[ -f "${BINARY_SOURCE}" ]]; then
    echo -e "${GREEN}[OK] Using local binary from ${BINARY_SOURCE}${NC}"
elif [[ -f "./pteronext-linux-${ARCH_NAME}" ]]; then
    BINARY_SOURCE="./pteronext-linux-${ARCH_NAME}"
    echo -e "${GREEN}[OK] Using local binary in current directory${NC}"
else
    echo -e "${CYAN}[DOWNLOAD] Fetching pre-compiled PteroNext Panel binary (${ARCH_NAME})...${NC}"
    echo -e "           CDN: ${BOLD}${DOWNLOAD_URL}${NC}"
    
    DOWNLOAD_SUCCESS=0
    if command -v curl &> /dev/null; then
        if curl -fSL --progress-bar -o "${TEMP_BINARY}" "${DOWNLOAD_URL}"; then
            DOWNLOAD_SUCCESS=1
        fi
    elif command -v wget &> /dev/null; then
        if wget -q --show-progress -O "${TEMP_BINARY}" "${DOWNLOAD_URL}"; then
            DOWNLOAD_SUCCESS=1
        fi
    fi

    # Fallback if primary CDN fails
    if [[ $DOWNLOAD_SUCCESS -ne 1 ]] || [[ ! -s "${TEMP_BINARY}" ]]; then
        echo -e "${AMBER}[WARN] Primary CDN download failed, trying fallback...${NC}"
        if command -v curl &> /dev/null; then
            curl -fSL -o "${TEMP_BINARY}" "${GITHUB_FALLBACK_URL}" || true
        fi
    fi

    # Validate downloaded binary
    if [[ -s "${TEMP_BINARY}" ]]; then
        BINARY_SOURCE="${TEMP_BINARY}"
        echo -e "${GREEN}[OK] Binary downloaded successfully ($(du -h "${TEMP_BINARY}" | cut -f1)).${NC}"
    else
        # Fallback to Go build if Go is available and source code is present
        if command -v go &> /dev/null && [[ -f "${SCRIPT_DIR}/core/main.go" ]]; then
            echo -e "${CYAN}[BUILD] Compiling PteroNext from local source...${NC}"
            cd "${SCRIPT_DIR}/core"
            CGO_ENABLED=0 go build -ldflags="-s -w" -o "${TEMP_BINARY}" main.go
            BINARY_SOURCE="${TEMP_BINARY}"
        else
            echo -e "${RED}[ERROR] Failed to download PteroNext binary for ${ARCH_NAME}.${NC}"
            echo -e "Please verify internet connectivity or manual installation instructions at https://pteronext.com/docs"
            exit 1
        fi
    fi
fi

# Create pteronext system user if not existing
if ! id -u pteronext &>/dev/null; then
    echo -e "${CYAN}[USER] Creating dedicated system user 'pteronext'...${NC}"
    useradd --system --no-create-home --shell /usr/sbin/nologin pteronext || useradd -r -s /bin/false pteronext
fi

# Setup directory structure
echo -e "${CYAN}[DIR] Setting up /opt/pteronext and /var/lib/pteronext...${NC}"
mkdir -p "${INSTALL_DIR}"
mkdir -p "${DATA_DIR}" "${DATA_DIR}/backups" "${DATA_DIR}/eggs"

# Copy binary
cp -f "${BINARY_SOURCE}" "${INSTALL_DIR}/pteronext"
chmod +x "${INSTALL_DIR}/pteronext"

# Generate JWT Secret if not already generated
JWT_SECRET_FILE="${DATA_DIR}/.jwt_secret"
if [[ ! -f "$JWT_SECRET_FILE" ]]; then
    head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32 > "$JWT_SECRET_FILE"
    chmod 600 "$JWT_SECRET_FILE"
fi
JWT_SECRET="$(cat "$JWT_SECRET_FILE")"

# Set permissions
chown -R pteronext:pteronext "${INSTALL_DIR}" "${DATA_DIR}"

# Create Systemd Service Unit
echo -e "${CYAN}[SYSTEMD] Installing systemd service unit...${NC}"
cat > "${SERVICE_PATH}" <<EOF
[Unit]
Description=PteroNext Panel Core Service
Documentation=https://github.com/pteronext/panel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pteronext
Group=pteronext
WorkingDirectory=${DATA_DIR}
ExecStart=${INSTALL_DIR}/pteronext --data ${DATA_DIR} --port 8080 --host 0.0.0.0 --jwt-secret ${JWT_SECRET}
Restart=always
RestartSec=5s

# Security Hardening
LimitNOFILE=65535
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

# Reload and enable service
systemctl daemon-reload
systemctl enable pteronext.service
systemctl restart pteronext.service

# Verify service running
sleep 2
if systemctl is-active --quiet pteronext; then
    SERVER_IP="$(curl -s -4 https://icanhazip.com || hostname -I | awk '{print $1}' || echo "YOUR-SERVER-IP")"
    echo ""
    echo -e "${GREEN}${BOLD}=====================================================================${NC}"
    echo -e "${GREEN}${BOLD}  ✓ PteroNext Panel Successfully Installed & Running!${NC}"
    echo -e "${GREEN}${BOLD}=====================================================================${NC}"
    echo ""
    echo -e "  🌐 Web Panel URL:   ${BOLD}http://${SERVER_IP}:8080${NC}"
    echo -e "  👤 Default User:    ${BOLD}admin${NC} (admin@pteronext.internal)"
    echo -e "  🔑 Default Pass:    ${BOLD}admin123456${NC}"
    echo ""
    echo -e "  📂 Data Directory:  ${DATA_DIR}"
    echo -e "  ⚙️ Service Status:  ${BOLD}systemctl status pteronext${NC}"
    echo -e "  📋 Live Logs:       ${BOLD}journalctl -u pteronext -f${NC}"
    echo ""
    echo -e "${AMBER}IMPORTANT: Please change the default admin password immediately in${NC}"
    echo -e "${AMBER}the User Account Settings modal upon logging in!${NC}"
    echo ""
else
    echo -e "${RED}[ERROR] PteroNext service failed to start. Check logs with:${NC}"
    echo "journalctl -u pteronext.service -e"
    exit 1
fi
