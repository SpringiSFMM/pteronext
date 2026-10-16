# PteroNext — Next-Generation Cloud-Native Game Server Platform

<p align="center">
  <img src="https://img.shields.io/badge/version-v2.9.1-indigo?style=for-the-badge" alt="Version 2.9.1">
  <img src="https://img.shields.io/badge/architecture-Single%20Binary%20Go%20%2B%20React-emerald?style=for-the-badge" alt="Go + React Single Binary">
  <a href="https://buymeacoffee.com/springisfm"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support-amber?style=for-the-badge&logo=buy-me-a-coffee&logoColor=white" alt="Buy Me A Coffee"></a>
  <a href="https://discord.gg/UJ28Umsx25"><img src="https://img.shields.io/badge/Discord-Community-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord Community"></a>
  <img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="License MIT">
</p>

---

> 📖 **Vollständige Dokumentation & Handbuch:**  
> Eine detaillierte deutsche Dokumentation zu Architektur, allen Features, Installation, API/CLI-Referenz und Sicherheits-Best-Practices findest du in der [**DOCUMENTATION.md**](DOCUMENTATION.md).

---

## 🌟 Executive Overview

**PteroNext** is a premier, high-performance cloud-native game server management platform developed by **Springi-SFM**. Designed from the ground up to replace resource-heavy, multi-layered legacy architectures, PteroNext bundles an ultra-fast compiled **Go backend** and a modern **React 18 / Vite / TypeScript single-page application** into a **single self-contained static binary** with native **Docker & Wings** daemon synchronization.

---

## ⚡ Core Enterprise Features & Innovations

### 1. 🤖 Intelligent Crash Analyzer with 1-Click Auto-Fix
- **Automated Stacktrace Diagnostics**: Instantly parses and identifies common server crash root causes, including Java runtime mismatches (e.g. Java 21 vs. Java 17 class version errors), port conflicts, cgroup out-of-memory (OOM) kills, and YAML indentation syntax errors.
- **Interactive Remediation Banner**: Displays clear diagnostic summaries and provides a 1-click action button to automatically adjust container configurations and restart the instance cleanly.

### 2. ⏳ File Time-Machine (Micro-Snapshots & Diff Engine)
- **Automatic Version History**: Captures instantaneous revisions of files before every editor save, keeping a complete timeline of historical changes.
- **Side-by-Side Unified Diff View**: Color-coded line-by-line inspection highlighting added and removed content.
- **1-Click Rollback**: Instantly revert any modified or corrupted configuration file back to any historical snapshot.

### 3. 🌐 Zero-Config Cloudflare DNS & SRV Automation
- **Subdomain Provisioning**: Effortlessly assign custom subdomains directly from the network management dashboard.
- **Dual A & SRV Record Generation**: Automatically configures public A-records pointing to the node IP and game-specific SRV records with the allocation port, allowing players to connect without manual port entry.
- **Secure Integration Settings**: Centralized API token and zone configuration in the administrative control center.

### 4. 🧪 Instant Server Cloning & 1-Click Staging
- **Sandbox Environment Duplication**: Clones server files, environment settings, and configurations to an isolated staging instance in seconds.
- **Automatic Port Allocation**: Identifies and links available node ports automatically so risky updates and modpack tests can be verified without downtime.

### 5. 🔒 Strict Server Suspension Lockdown
- **Instant Container Termination**: Automatically halts container processes the moment an administrator suspends a server.
- **Total Operational Lockdown**: Enforces hard restrictions preventing suspended server owners from modifying files, uploading content, issuing terminal commands, or starting container instances.

### 6. 💬 Discord Bot Integration & DM Verification
- **Automated 6-Digit Direct Message Codes**: Delivers a cryptographic one-time code directly to the user's Discord inbox via the official bot.
- **Guild Membership Enforcement**: Verifies that users are active members of the community Discord server before issuing tokens.
- **Global Avatar Synchronization**: Custom uploaded avatars and Discord profile pictures propagate across the sidebar, header, and administrative dashboards.

### 7. 💤 Server Resource Auto-Scaler (Smart Sleep Mode)
- **Zero-Player Auto-Suspend**: Automatically pauses idling game servers after a customizable inactivity timeout to reclaim memory and CPU cycles.
- **Instant Wakeup**: Wakes containers seamlessly when incoming network requests or administrative actions occur.

### 8. 🎨 Enterprise Themes & Custom CSS Live Studio
- **Curated High-Contrast Themes**: 11 hand-crafted visual palettes (including Cyberpunk, Midnight OLED, Aurora, Sakura, and Matrix) tailored for long sessions.
- **Dynamic Background Canvases**: Choose between dynamic glowing ambients, cyber mesh grids, pure OLED black, and modern dark modes.
- **Live Custom CSS Studio**: Apply custom CSS stylesheets in real time with instant feedback.

### 9. 🛡️ Granular Zero-Trust RBAC & Security Hardening
- **Path-Level File Security**: Granular allow and deny rules for delegated subusers, visually marking protected paths with security locks.
- **Command Policy Rules**: Whitelist and blacklist filtering for interactive console commands.
- **Log Credential Redaction**: Automatically scrubs API keys, Discord tokens, passwords, and database secrets from real-time console streams.
- **Hardened Two-Factor Authentication (2FA)**: Case-insensitive login, single-use recovery codes, brute-force mitigation, and emergency CLI recovery utilities.

### 10. 👥 Multi-User Co-Pilot & Real-Time Presence
- **Live Team Telemetry**: Visual indicators displaying active administrators and which server nodes or settings they are viewing in real time.
- **Incident Safe Mode**: 1-click isolation mode to lock network ingress and enforce whitelists during exploit investigations or maintenance.

### 11. 🔄 Live Changelog Feed & Zero-Data-Loss 1-Click Updater
- **Live GitHub Release Tracking**: Directly checks the central repository for the latest commits, changelogs, and security releases.
- **Automated SQLite Safety Backups**: Creates point-in-time database snapshots prior to executing upgrades, ensuring zero data loss and flawless rollbacks.

---

## 🚀 Quick Start & Deployment

### Prerequisites
- Linux Server (Debian 12 / Ubuntu 22.04+ Recommended)
- Docker & Docker Compose
- Root access via SSH

### Deploying Updates
```bash
# Execute ultra-fast delta deployment in under 3 seconds:
./quick-update.sh <SERVER_IP> root
```

### Initial Administrative Credentials
- **Default Username:** `admin`
- **Default Password:** `admin123456`
- **Recommended Action:** Change administrative password and activate Two-Factor Authentication immediately upon first login.

---

## 📜 System Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| **CPU** | 1 vCore (x86_64 / arm64) | 2+ Cores (AMD / Intel Xeon / ARM) |
| **RAM** | 512 MB (Panel Core) | 1 GB+ (Panel Core) |
| **Storage** | 500 MB Free Disk | NVMe SSD Storage |
| **OS** | Linux (Kernel 5.4+) | Debian 12 / Ubuntu 22.04 LTS |

---

## ☕ Support PteroNext & Community

- **Buy Me a Coffee:** Support ongoing independent development and cluster hosting via [Buy Me a Coffee (springisfm)](https://buymeacoffee.com/springisfm).
- **Discord Community:** Join our official community for live support, setup guides, and feedback: [discord.gg/UJ28Umsx25](https://discord.gg/UJ28Umsx25).

---

## 📄 License & Attribution

Developed with precision by **Springi-SFM**.  
Distributed under the **MIT License**.
