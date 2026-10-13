#!/usr/bin/env bash
# ==============================================================================
# PteroNext & Wings - 1-Click Remote Server Deployment
# Usage: ./remote-deploy.sh [SERVER-IP] [SSH-USER]
# Default: ./remote-deploy.sh 217.20.120.126 root
# ==============================================================================

set -euo pipefail

export COPYFILE_DISABLE=1

SERVER_IP="${1:-217.20.120.126}"
SSH_USER="${2:-root}"
SSH_PASS="${SSH_PASS:-k7zyauEtGkSSyTNC}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${SSH_USER}@${SERVER_IP}"
PACKAGE="${SCRIPT_DIR}/pteronext-deploy.tar.gz"

echo "====================================================================="
echo "  PTERONEXT & WINGS - 1-CLICK REMOTE DEPLOYMENT"
echo "  Ziel:    ${TARGET}"
echo "  Domains: panel.pteronext.com & wings.pteronext.com"
echo "====================================================================="

echo ""

if [ ! -f "${PACKAGE}" ]; then
  echo "-> Erstelle Deployment-Paket ${PACKAGE}..."
  (cd "${SCRIPT_DIR}" && tar --no-mac-metadata --no-xattrs -czf "${PACKAGE}" -C deploy-package .)
fi

# 1. SSH-Key & Schnelle Authentifizierung prüfen
KEY_FILE="${HOME}/.ssh/id_ed25519"
if [ ! -f "${KEY_FILE}" ] && [ ! -f "${HOME}/.ssh/id_rsa" ]; then
  mkdir -p "${HOME}/.ssh"
  chmod 700 "${HOME}/.ssh"
  ssh-keygen -t ed25519 -N "" -f "${KEY_FILE}" -C "pteronext-deploy-key"
fi

PUB_KEY=""
[ -f "${KEY_FILE}.pub" ] && PUB_KEY="${KEY_FILE}.pub"
[ -z "${PUB_KEY}" ] && [ -f "${HOME}/.ssh/id_rsa.pub" ] && PUB_KEY="${HOME}/.ssh/id_rsa.pub"

SSHPASS_BIN=""
if command -v sshpass &>/dev/null; then
  SSHPASS_BIN="$(command -v sshpass)"
elif [ -x "/opt/homebrew/bin/sshpass" ]; then
  SSHPASS_BIN="/opt/homebrew/bin/sshpass"
elif [ -x "/usr/local/bin/sshpass" ]; then
  SSHPASS_BIN="/usr/local/bin/sshpass"
fi

if ! ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new "${TARGET}" 'true' 2>/dev/null; then
  echo "-> Hinterlege SSH-Schlüssel auf dem Server für blitzschnellen, passwortlosen Zugriff..."
  if [ -n "${SSHPASS_BIN}" ] && [ -n "${SSH_PASS:-}" ]; then
    "${SSHPASS_BIN}" -p "${SSH_PASS}" ssh-copy-id -o StrictHostKeyChecking=accept-new ${PUB_KEY:+-i "$PUB_KEY"} "${TARGET}" 2>/dev/null || true
  else
    ssh-copy-id -o StrictHostKeyChecking=accept-new ${PUB_KEY:+-i "$PUB_KEY"} "${TARGET}" || true
  fi
fi

echo "-> Übertrage Paket und starte vollständiges System-Setup auf ${SERVER_IP}..."
echo ""

cat "${PACKAGE}" | ssh -o StrictHostKeyChecking=accept-new \
  -o GSSAPIAuthentication=no \
  -o ConnectTimeout=20 \
  "${TARGET}" \
  "export TERM=xterm-256color; export SERVER_IP='${SERVER_IP}'; mkdir -p /root/pteronext-install && tar -xzf - -C /root/pteronext-install && chmod +x /root/pteronext-install/setup-all-in-one.sh && /root/pteronext-install/setup-all-in-one.sh"


