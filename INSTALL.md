# 🚀 PteroNext Panel - Server Installations-Anleitung

PteroNext ist eine moderne, blitzschnelle Single-Binary-Lösung für Game-Server-Management. Im Gegensatz zum alten Pterodactyl benötigt PteroNext **kein PHP, kein Composer, kein Nginx und kein MySQL/Redis zwingend** – das gesamte Backend und das moderne React-Frontend sind in einer einzigen, performanten Go-Binary kompiliert.

---

## ⚡ Option 1: Vollautomatische 1-Pass Remote-Installation (Für deinen Server)

Wenn du das Panel & Wings direkt von deinem Mac auf deinen Server (`5.255.103.135`) installieren willst:

```bash
# Direkt aus dem panel-Verzeichnis ausführen:
./remote-deploy.sh 5.255.103.135 root
```
*(Du wirst genau **einmal** nach deinem root-Passwort gefragt. Das Skript streamt das gesamte Deployment-Paket, installiert Docker, Nginx, Certbot SSL für `panel.springisfm.de` & `wings.springisfm.de` und startet PteroNext Panel & Wings automatisch).*

---

## ⚡ Option 2: Lokale Installation auf dem Server direkt

### Was der Installer automatisch erledigt:
1. Erkennt die CPU-Architektur deines Servers (`x86_64 / amd64` oder `arm64 / aarch64`).
2. Installiert die Standalone-Binary nach `/opt/pteronext/pteronext`.
3. Richtet das Datenverzeichnis `/var/lib/pteronext` (Datenbank, Eggs, Backups) ein.
4. Erstellt einen isolierten Systembenutzer `pteronext`.
5. Erzeugt einen sicheren JWT-Schlüssel.
6. Richtet einen **systemd Service** ein (`pteronext.service`), der das Panel automatisch beim Server-Boot startet und bei Abstürzen neu startet.
7. Startet das Panel auf Port `8080`.

---

## 🖥️ Option 2: Standalone Single-Binary Manuell Ausführen

Falls du keinen systemd Service nutzen möchtest oder Docker vermeidest:

### 1. Binary wählen
- **Für 64-Bit Intel / AMD (Standard vServer & Dedicated):**
  [pteronext-linux-amd64](file:///opt/pteronext/core/pteronext-linux-amd64)
- **Für ARM64 (Oracle Cloud Ampere, Raspberry Pi, Hetzner CAX):**
  [pteronext-linux-arm64](file:///opt/pteronext/core/pteronext-linux-arm64)

### 2. Starten
```bash
chmod +x core/pteronext-linux-amd64

# Start auf Port 8080:
./core/pteronext-linux-amd64 --port 8080 --data /var/lib/pteronext
```

---

## 🐳 Option 3: Installation via Docker Compose

```bash
docker compose up -d
```

Das Panel ist anschließend sofort unter `http://<DEINE-SERVER-IP>:8080` erreichbar.

---

## 🔑 Erste Anmeldung & Zugangsdaten

Nach dem Start auf `http://<DEINE-SERVER-IP>:8080` navigieren:

- **Benutzername / E-Mail:** `admin` oder `admin@pteronext.internal`
- **Initial-Passwort:** `admin123456`

> ⚠️ **Wichtig:** Ändere das Initial-Passwort direkt nach dem ersten Login unter **Account Settings** (Klick auf den Profil-Button unten links)!

---

## 🔒 Optional: Domain & HTTPS (SSL via Nginx Reverse Proxy)

Falls du eine Domain (z.B. `panel.deinedomain.de`) mit automatischem Let's Encrypt SSL-Zertifikat nutzen möchtest:

### 1. Nginx & Certbot installieren
```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Nginx Konfiguration anlegen (`/etc/nginx/sites-available/pteronext.conf`):
```nginx
server {
    listen 80;
    server_name panel.deinedomain.de;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Aktivieren & SSL erstellen:
```bash
sudo ln -s /etc/nginx/sites-available/pteronext.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d panel.deinedomain.de
```

---

## 🛠️ Nützliche Befehle

| Aktion | Befehl |
|---|---|
| **Status prüfen** | `sudo systemctl status pteronext` |
| **Live Logs ansehen** | `sudo journalctl -u pteronext -f` |
| **Panel neu starten** | `sudo systemctl restart pteronext` |
| **Panel stoppen** | `sudo systemctl stop pteronext` |
| **Datenbank-Backup** | `cp /var/lib/pteronext/pteronext.db /var/lib/pteronext/pteronext.db.bak` |

---

## 🎮 Wings Daemon Anbindung

1. Melde dich im Web Panel an.
2. Gehe in den Administrationsbereich auf **Nodes**.
3. Klicke auf **Configuration** für den gewünschten Node.
4. Kopiere die Konfiguration in `/etc/pterodactyl/config.yml` auf deinem Wings-Host.
5. Starte Wings: `systemctl restart wings`.
