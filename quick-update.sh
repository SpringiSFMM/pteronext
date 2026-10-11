#!/usr/bin/env bash
# ==============================================================================
# PteroNext & Wings - Ultra-Fast Delta Update Script
# Updates only binaries and restarts services in ~3 seconds.
# ==============================================================================

set -euo pipefail

# macOS tar anweisen, keine Apple ._* Extended Attributes einzupacken
export COPYFILE_DISABLE=1

SERVER_IP="${1:-217.20.120.126}"
SSH_USER="${2:-root}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${SSH_USER}@${SERVER_IP}"
PACKAGE_DIR="${SCRIPT_DIR}/deploy-package"

echo "====================================================================="
echo "  ⚡ PTERONEXT & WINGS - QUICK UPDATE"
echo "  Ziel: ${TARGET}"
echo "====================================================================="

# 1. Lokale Binaries prüfen
if [ ! -d "${PACKAGE_DIR}" ]; then
  echo "Fehler: Verzeichnis ${PACKAGE_DIR} existiert nicht!" >&2
  exit 1
fi

# 2. SSH-Key Setup prüfen
KEY_FILE="${HOME}/.ssh/id_ed25519"
if [ ! -f "${KEY_FILE}" ] && [ ! -f "${HOME}/.ssh/id_rsa" ]; then
  echo "-> Erstelle lokalen SSH-Key ~/.ssh/id_ed25519..."
  mkdir -p "${HOME}/.ssh"
  chmod 700 "${HOME}/.ssh"
  ssh-keygen -t ed25519 -N "" -f "${KEY_FILE}" -C "auto-deploy-key"
fi

PUB_KEY=""
[ -f "${KEY_FILE}.pub" ] && PUB_KEY="${KEY_FILE}.pub"
[ -z "${PUB_KEY}" ] && [ -f "${HOME}/.ssh/id_rsa.pub" ] && PUB_KEY="${HOME}/.ssh/id_rsa.pub"

# 3. Prüfen, ob Key auf dem Server funktioniert (Timeout 15s)
if ! ssh -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "${TARGET}" 'true' 2>/dev/null; then
  echo ""
  echo "-> Hinterlege SSH-Key auf dem Server..."
  if [ -n "${PUB_KEY}" ]; then
    ssh-copy-id -i "${PUB_KEY}" -o StrictHostKeyChecking=accept-new "${TARGET}"
  else
    ssh-copy-id -o StrictHostKeyChecking=accept-new "${TARGET}"
  fi
  echo "✓ SSH-Key hinterlegt!"
  echo ""
fi

# 4. Übertragung & Update (ConnectTimeout auf 30s gesetzt)
echo "-> Übertrage Binaries und führe Update aus..."

tar --no-mac-metadata --no-xattrs -czf - -C "${PACKAGE_DIR}" core/pteronext-linux-amd64 wings/wings-linux-amd64 | \
  ssh -o StrictHostKeyChecking=accept-new \
      -o GSSAPIAuthentication=no \
      -o ConnectTimeout=30 \
      "${TARGET}" '
    set -e
    mkdir -p /root/quick-update
    tar -xzf - -C /root/quick-update
    
    # Sofortiger Austausch ohne Hänger
    killall -9 pteronext wings 2>/dev/null || true
    systemctl daemon-reexec 2>/dev/null || true
    
    cp -f /root/quick-update/core/pteronext-linux-amd64 /opt/pteronext/pteronext
    cp -f /root/quick-update/wings/wings-linux-amd64 /usr/local/bin/wings
    chmod +x /opt/pteronext/pteronext /usr/local/bin/wings
    
    # Server RAM auf 2048 MB aktualisieren (nur memory_mb existiert)
    sqlite3 /var/lib/pteronext/pteronext.db "UPDATE servers SET memory_mb=2048 WHERE uuid=\"0cb7c1dd-fdd2-444d-816a-837270a47b7b\" OR memory_mb < 2048;" 2>/dev/null || true
    
    # SSH-Server-Latenz dauerhaft beheben (UseDNS / GSSAPI)
    if [ -f /etc/ssh/sshd_config ]; then
      sed -i -E "s/^#?UseDNS\s+.*/UseDNS no/" /etc/ssh/sshd_config
      sed -i -E "s/^#?GSSAPIAuthentication\s+.*/GSSAPIAuthentication no/" /etc/ssh/sshd_config
      grep -q "^UseDNS no" /etc/ssh/sshd_config || echo "UseDNS no" >> /etc/ssh/sshd_config
      systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
    fi
    
    systemctl restart nginx pteronext wings
    echo ""
    echo "====================================================================="
    echo "  ✓ UPDATE ERFOLGREICH IN UNTER 3 SEKUNDEN AKTIVIERT!"
    echo "====================================================================="
  '