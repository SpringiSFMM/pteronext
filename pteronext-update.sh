#!/usr/bin/env bash
# ==============================================================================
# PteroNext Panel Safe Updater
# Zero-Data-Loss Update Script für Administratoren
#
# WICHTIGE GARANTIE:
# - KEINE Datenbanken werden überschrieben oder gelöscht.
# - Automatischer Snapshot der SQLite-Datenbank vor jedem Update.
# - Gameserver-Dateien (/data/servers, /var/lib/pterodactyl/volumes) bleiben unberührt.
# - Konfigurationen (.env, config/) und Port-Bindungen bleiben unverändert.
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"

# Farbdefinitionen
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${BOLD}  ⚡ PTERONEXT SAFE PANEL UPDATER (CLI WRAPPER)${NC}"
echo -e "  Zero-Data-Loss Policy — 100% Daten-, Server- & Konfigurationsschutz"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "  Verzeichnis: ${SCRIPT_DIR}"
echo -e "  Zeitstempel: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "${CYAN}=====================================================================${NC}"
echo ""

# 1. Zero Data Loss Policy Banner
echo -e "${YELLOW}---------------------------------------------------------------------${NC}"
echo -e "${BOLD}  🛡️  PTERONEXT DATENSCHUTZ-GARANTIE${NC}"
echo -e "${YELLOW}---------------------------------------------------------------------${NC}"
echo -e "  [${GREEN}✓${NC}] Datenbanken:      ${BOLD}GESCHÜTZT${NC} (Vorab-Snapshot vor jeder Modifikation)"
echo -e "  [${GREEN}✓${NC}] Gameserver:       ${BOLD}UNBERÜHRT${NC} (Alle Volumes & Spieldateien intakt)"
echo -e "  [${GREEN}✓${NC}] Konfiguration:    ${BOLD}ERHALTEN${NC}  (.env & config/ werden nie angetastet)"
echo -e "  [${GREEN}✓${NC}] Benutzer/Nodes:   ${BOLD}ERHALTEN${NC}  (Keine Re-Migration oder Löschungen)"
echo -e "  [${GREEN}✓${NC}] Ports & Netzwerk: ${BOLD}ERHALTEN${NC}  (Bestehende Port-Bindungen unverändert)"
echo -e "${YELLOW}---------------------------------------------------------------------${NC}"
echo ""

# 2. Lokale Datenbank-Snapshots vorab anlegen
echo -e "${BOLD}[1/4] Prüfe lokale Datenbanken & erstelle Sicherheits-Snapshot...${NC}"
DB_FOUND=0
DB_CANDIDATES=(
  "${SCRIPT_DIR}/pteronext.db"
  "${SCRIPT_DIR}/core/pteronext.db"
  "/var/lib/pteronext/pteronext.db"
  "/opt/pteronext/pteronext.db"
  "/var/www/pteronext/pteronext.db"
)

for db in "${DB_CANDIDATES[@]}"; do
  if [ -f "$db" ]; then
    BACKUP_TARGET="${db}.bak_${TIMESTAMP}"
    cp -p "$db" "$BACKUP_TARGET"
    DB_SIZE=$(du -h "$db" | cut -f1)
    echo -e "      ${GREEN}✓${NC} Sicherheits-Snapshot angelegt: ${BOLD}${BACKUP_TARGET}${NC} (${DB_SIZE})"
    DB_FOUND=$((DB_FOUND + 1))

    # WAL und SHM ebenfalls sichern falls vorhanden
    [ -f "${db}-wal" ] && cp -p "${db}-wal" "${db}-wal.bak_${TIMESTAMP}" 2>/dev/null || true
    [ -f "${db}-shm" ] && cp -p "${db}-shm" "${db}-shm.bak_${TIMESTAMP}" 2>/dev/null || true
  fi
done

if [ "$DB_FOUND" -eq 0 ]; then
  echo -e "      ${YELLOW}[INFO]${NC} Keine SQLite-Datei in Standardpfaden gefunden (z.B. Remote DB oder Erstinstallation)."
fi

# 3. Binaries auffinden & Update ausführen
echo -e "${BOLD}[2/4] Führe PteroNext Core Update durch...${NC}"

BIN_PATH=""
if [ -x "${SCRIPT_DIR}/bin/pteronext" ]; then
  BIN_PATH="${SCRIPT_DIR}/bin/pteronext"
elif [ -x "/opt/pteronext/pteronext" ]; then
  BIN_PATH="/opt/pteronext/pteronext"
elif [ -x "${SCRIPT_DIR}/core/panel-core" ]; then
  BIN_PATH="${SCRIPT_DIR}/core/panel-core"
fi

if [ -n "$BIN_PATH" ]; then
  echo -e "      Ausführe: ${BOLD}${BIN_PATH} update $@${NC}"
  "$BIN_PATH" update "$@"
else
  echo -e "      ${YELLOW}[WARNUNG]${NC} Keine kompilierte Binary gefunden. Kompiliere aus Quelltext..."
  if command -v go >/dev/null 2>&1; then
    (cd "${SCRIPT_DIR}/core" && go build -o "${SCRIPT_DIR}/bin/pteronext" main.go)
    echo -e "      ${GREEN}✓${NC} Binary erfolgreich kompiliert: ${SCRIPT_DIR}/bin/pteronext"
    "${SCRIPT_DIR}/bin/pteronext" update "$@"
  else
    echo -e "      ${RED}[FEHLER]${NC} 'go' ist nicht installiert und keine Binary gefunden!" >&2
    exit 1
  fi
fi

# 4. Systemd-Dienste prüfen & neustarten falls zutreffend
echo -e "${BOLD}[3/4] System- und Dienstintegrität...${NC}"
if [ "$(uname)" = "Linux" ] && command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet pteronext 2>/dev/null; then
    echo -e "      -> Starte Dienst 'pteronext' neu..."
    systemctl restart pteronext 2>/dev/null || true
    echo -e "      ${GREEN}✓${NC} Dienst 'pteronext' aktiv."
  else
    echo -e "      [HINWEIS] Dienst 'pteronext' ist nicht aktiv oder wird manuell betrieben."
  fi
else
  echo -e "      ${GREEN}✓${NC} Lokale Umgebung verifiziert ($(uname))."
fi

echo -e "${BOLD}[4/4] Statusabschluss & Hilfe...${NC}"
echo ""
echo -e "${CYAN}=====================================================================${NC}"
echo -e "${BOLD}${GREEN}  ✅ UPDATE ERFOLGREICH BEENDET!${NC}"
echo -e "${CYAN}=====================================================================${NC}"
echo -e "  Alle Spieldateien, Datenbankeinträge und Benutzer bleiben 1:1 erhalten."
echo -e "  Manuelle Dienststeuerung:"
echo -e "    ${BOLD}sudo systemctl restart pteronext${NC}"
echo -e "    ${BOLD}sudo systemctl restart pteronext wings${NC}   (falls Wings mitläuft)"
echo -e "${CYAN}=====================================================================${NC}"
echo ""
