# 🎯 PteroNext - Tech Creator & YouTuber Outreach Dossier

This dossier contains researched top tier tech creators, self-host reviewers, and Linux/DevOps YouTubers who regularly showcase self-hosted software, Docker projects, and game server infrastructure.

---

## 👥 Target Creator Profiles & Tailored Pitches

### 1. Techno Tim (Focus: HomeLab, Kubernetes, Game Server Self-Hosting)
* **Audience:** ~350k Subscribers · Homelab enthusiasts, Docker self-hosters, Proxmox users.
* **Why PteroNext is a fit:** He has done multiple tutorials on Pterodactyl, but frequently mentions how complex the multi-tier PHP/Node/Daemon setup can be for beginners.
* **Subject:** `Open-source: Single-binary Go replacement for Pterodactyl (1-command installer)`
* **Email Body:**
```text
Hey Tim,

Big fan of your homelab and game server videos!

I noticed in your previous Pterodactyl and Pelican coverage how much setup friction comes from the legacy stack (Composer, PHP 8.3 FPM, Nginx, Redis queues, separate Wings daemon).

We built PteroNext (https://pteronext.com) — a complete, open-source rewrite into a single, self-contained Go binary with an embedded React 18 UI.

Key points that your viewers would love:
• 1-Command install: curl -sSL https://pteronext.com/install.sh | bash (takes ~10 seconds on Debian/Ubuntu/CentOS).
• 45 MB baseline RAM usage instead of 350+ MB (no PHP or Redis workers required).
• Native Docker daemon integration + built-in Community Egg Marketplace (Minecraft, Palworld, Rust, FiveM, Node.js).
• Intelligent Crash Analyzer that reads stacktraces and auto-suggests 1-click fixes for memory/Java errors.

The GitHub repo is 100% open-source: https://github.com/SpringiSFMM/pteronext
Live demo instance: https://panel.pteronext.com (User: admin / Pass: admin123456)

Would love to give you early access or answer any questions if you'd like to spin it up for a video!

Best regards,
Springi-SFM & the PteroNext Team
```

---

### 2. NetworkChuck (Focus: Gamified Tech, Cloud, Docker, Fast Installs)
* **Audience:** ~3.8M Subscribers · Tech beginners, Linux learners, gamers.
* **Why PteroNext is a fit:** Chuck LOVES "1-command magic" that turns a blank VPS into a fully functional cloud server in seconds.
* **Subject:** `This 1 command turns any $5 VPS into an insane Game Server Cloud Panel (PteroNext)`
* **Email Body:**
```text
Hey Chuck,

You need to try this: `curl -sSL https://pteronext.com/install.sh | bash`

We built PteroNext — an open-source, single-binary server management platform written in Go. In less than 15 seconds, it provisions a complete game server cloud on any Linux machine with zero dependencies.

Why your community will go crazy for it:
1. Zero PHP / Zero database configuration needed — runs as a single static binary.
2. Built-in Egg Marketplace: 1-click launch for Minecraft, FiveM, Palworld, Rust, or Python bots.
3. Automated Cloudflare DNS: Assigns custom subdomains with SRV records automatically.
4. Discord Bot integration for server controls directly inside chat channels.

Everything is MIT licensed on GitHub: https://github.com/SpringiSFMM/pteronext

Check out the live dashboard here: https://pteronext.com

Coffee's on me: https://buymeacoffee.com/springisfm ☕

Cheers,
Springi
```

---

### 3. Wolfgang's Channel (Focus: Hardware, Low-Power HomeLab, Benchmarks)
* **Audience:** ~450k Subscribers · Focuses on low power, CPU efficiency, memory optimization.
* **Why PteroNext is a fit:** Wolfgang values raw Go performance over heavy interpreted runtimes.
* **Subject:** `Rewriting Pterodactyl in Go: Benchmarking RAM usage & daemon latency`
* **Email Body:**
```text
Hi Wolfgang,

Love your hardware efficiency and homelab benchmark analyses.

We recently launched PteroNext (https://pteronext.com) to tackle a major inefficiency in game server management: legacy panels consuming hundreds of megabytes of RAM before even running a single game container.

By compiling the backend into Go and serving the static frontend directly from the binary:
• Idle panel memory dropped from ~380 MB to 42 MB.
• API response latency dropped from ~48 ms to under 3 ms.
• 1-command installer without external database server overhead.

We prepared open benchmarks and would love your honest critique or review:
GitHub: https://github.com/SpringiSFMM/pteronext

Happy to provide a dedicated test VPS if you're interested!

Best,
Springi
```

---

### 4. Christian Lempa (Focus: Enterprise DevOps, Docker, Modern UI)
* **Audience:** ~300k Subscribers · Sysadmins, DevOps engineers, homelab architects.
* **Subject:** `PteroNext: A modern, cloud-native container manager for game servers & bots`
* **Focus Angle:** Clean REST API, Prometheus-style telemetry metrics, Caddy SSL integration, audit logs.

---

### 5. DB Tech (Focus: Self-Hosted Docker Apps, Portainer, Easy Setups)
* **Audience:** ~120k Subscribers · Step-by-step installation guides for homelabbers.
* **Subject:** `Step-by-step self-hosting guide: PteroNext Panel in under 2 minutes`
* **Focus Angle:** The sheer simplicity of running the installer and importing eggs from the Ecosystem Store.
