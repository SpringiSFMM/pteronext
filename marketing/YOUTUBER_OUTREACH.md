# 🎯 PteroNext - Tech Creator & YouTuber Outreach Dossier

This dossier contains researched top tier tech creators, self-host reviewers, and Linux/DevOps YouTubers who regularly showcase self-hosted software, Docker projects, and game server infrastructure.

---

## 👥 Target Creator Profiles & Tailored Pitches

### 1. Techno Tim (Focus: HomeLab, Kubernetes, Game Server Self-Hosting)
* **Audience:** ~350k Subscribers · Homelab enthusiasts, Docker self-hosters, Proxmox users.
* **Why PteroNext is a fit:** He has done multiple tutorials on traditional server panels, but frequently highlights the complexity of legacy multi-dependency and multi-process stacks for beginners.
* **Subject:** `Open-source: Single-binary Go game server manager (1-command installer)`
* **Email Body:**
```text
Hey Tim,

Big fan of your homelab and game server videos!

I noticed in your server management coverage how much setup friction comes from legacy multi-process server managers (Composer, PHP FPM, Nginx, Redis queues, separate daemon processes).

We built PteroNext (https://pteronext.com) — a modern, open-source game and application server manager engineered as a single, self-contained Go binary with an embedded React 18 UI.

Key points that your viewers would love:
• 1-Command install: curl -sSL https://pteronext.com/install.sh | bash (takes ~10 seconds on Debian/Ubuntu/CentOS).
• 45 MB baseline RAM usage instead of 350+ MB (no PHP or Redis workers required).
• Native Docker daemon integration + built-in Community Egg Marketplace (Minecraft, Palworld, Rust, FiveM, Node.js).
• Intelligent Crash Analyzer that reads stacktraces and auto-suggests 1-click fixes for memory/Java errors.
• Modern Web UI: Embedded reactive React 18 dashboard with dark mode and zero config overhead.

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
* **Why PteroNext is a fit:** Wolfgang values raw Go performance and low idle power/resource consumption over heavy multi-service runtimes.
* **Subject:** `Modern Go Server Architecture: Benchmarking RAM usage & daemon latency`
* **Email Body:**
```text
Hi Wolfgang,

Love your hardware efficiency and homelab benchmark analyses.

We recently launched PteroNext (https://pteronext.com) to tackle resource overhead in game server management: legacy multi-stack systems consuming hundreds of megabytes of RAM before even running a single game container.

By compiling the backend into a single Go binary and serving the modern Web UI directly:
• Idle baseline memory dropped to 45 MB (over 85% reduction compared to traditional multi-stack panels).
• API response latency dropped from ~48 ms to under 3 ms.
• Instant 1-command installer without external database server overhead.
• Fully self-contained single Go binary with native Docker engine orchestration.

We prepared open benchmarks and would love your honest critique or review:
GitHub: https://github.com/SpringiSFMM/pteronext

Happy to provide a dedicated test VPS if you're interested!

Best,
Springi
```

---

### 4. Christian Lempa (Focus: Enterprise DevOps, Docker, Modern UI)
* **Audience:** ~300k Subscribers · Sysadmins, DevOps engineers, homelab architects.
* **Why PteroNext is a fit:** Christian focuses on clean architecture, modern Docker/container orchestration, and infrastructure as code.
* **Subject:** `PteroNext: A modern, cloud-native container manager for game servers & bots`
* **Email Body:**
```text
Hey Christian,

Huge fan of your DevOps and homelab architecture videos!

In the self-hosting and game server world, traditional server panels have been standard for years, but their legacy multi-stack architecture (PHP FPM, Composer, Redis workers, multi-tier daemons) adds significant friction to modern containerized environments.

We built PteroNext (https://pteronext.com) — a ground-up cloud-native server manager compiled into a single, highly-optimized Go binary with an embedded modern React 18 interface.

Key architectural highlights that resonate with your DevOps audience:
• Single Go binary deployment: No PHP, Nginx, or external background workers required.
• 45 MB baseline RAM: 88% reduction in idle memory compared to legacy multi-stack systems.
• Instant 1-command installer: curl -sSL https://pteronext.com/install.sh | bash (provisions systemd service and environment in ~12 seconds).
• Modern Web UI: Embedded React 18 frontend with reactive real-time telemetry.
• Cloud-native integrations: Native Docker Engine communication, automated Cloudflare DNS sync, Zero-Config TLS, and structured JSON logs.
• Built-in Community Egg Store: 1-click deployment for Minecraft, Palworld, Rust, FiveM, and bot runtimes.

The repository is 100% open source under the MIT license:
GitHub: https://github.com/SpringiSFMM/pteronext
Live demo: https://panel.springisfm.de

Would love to get your thoughts on the architecture, or provide a dedicated VPS if you'd like to test or feature it!

Best regards,
Patrick (Springi-SFM) & the PteroNext Team
```

---

### 5. DB Tech (Focus: Self-Hosted Docker Apps, Portainer, Easy Setups)
* **Audience:** ~120k Subscribers · Step-by-step installation guides for homelabbers.
* **Subject:** `Step-by-step self-hosting guide: PteroNext Panel in under 2 minutes`
* **Focus Angle:** The sheer simplicity of running the installer and importing eggs from the Ecosystem Store.
