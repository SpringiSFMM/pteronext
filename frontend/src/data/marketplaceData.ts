export interface MarketplaceVariable {
  name: string;
  env_variable: string;
  default_value: string;
  description_de: string;
  description_en: string;
  user_viewable: boolean;
  user_editable: boolean;
  rules?: string;
}

export type MarketplaceCategory = 'all' | 'games' | 'bots' | 'web' | 'databases';

export interface MarketplaceEgg {
  id: string;
  slug: string;
  name: string;
  category: 'games' | 'bots' | 'web' | 'databases';
  subCategory?: string;
  author: string;
  author_name?: string;
  version: string;
  downloads: number;
  downloads_count?: number;
  stars?: number;
  description_de: string;
  description_en: string;
  docker_image: string;
  startup: string;
  startup_command?: string;
  stop?: string;
  variables: MarketplaceVariable[];
  features?: string[];
  verified?: boolean;
  file_size?: string;
  egg_json?: string | object;
}

export const MARKETPLACE_CATEGORIES: { id: MarketplaceCategory; label_de: string; label_en: string; icon: string }[] = [
  { id: 'all', label_de: 'Alle Eggs', label_en: 'All Eggs', icon: 'Sparkles' },
  { id: 'games', label_de: 'Games', label_en: 'Games', icon: 'Gamepad2' },
  { id: 'bots', label_de: 'Bots & Discord', label_en: 'Bots & Discord', icon: 'Bot' },
  { id: 'web', label_de: 'Web Stacks & APIs', label_en: 'Web Stacks & APIs', icon: 'Globe' },
  { id: 'databases', label_de: 'Databases', label_en: 'Databases', icon: 'Database' },
];

export const CURATED_MARKETPLACE_EGGS: MarketplaceEgg[] = [
  {
    id: 'egg-minecraft-paper',
    slug: 'minecraft-paper',
    name: 'Minecraft — Paper & Purpur (Java 21)',
    category: 'games',
    subCategory: 'Minecraft',
    author: 'PteroNext Core Team',
    version: '1.21.4',
    downloads: 14280,
    stars: 542,
    verified: true,
    file_size: '4.2 KB',
    description_de: 'Hochoptimierter PaperMC / Purpur Minecraft Server mit Java 21, Aikar JVM Flags, automatischer EULA-Bestätigung und schnellem Build-Updater.',
    description_en: 'High-performance PaperMC and Purpur Minecraft server running Java 21 with Aikar JVM optimization flags, auto-EULA, and fast build updates.',
    docker_image: 'ghcr.io/pterodactyl/yolks:java_21',
    startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}}',
    stop: 'stop',
    features: ['aikar_flags', 'eula_auto', 'auto_restart_on_crash'],
    variables: [
      {
        name: 'Server Jar File',
        env_variable: 'SERVER_JARFILE',
        default_value: 'server.jar',
        description_de: 'Dateiname der ausführbaren Server JAR-Datei im Hauptverzeichnis.',
        description_en: 'Executable server JAR filename located in the root directory.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string|max:64',
      },
      {
        name: 'Minecraft Version',
        env_variable: 'MINECRAFT_VERSION',
        default_value: 'latest',
        description_de: 'Zu installierende Version (z. B. latest, 1.21.4, 1.20.4).',
        description_en: 'Minecraft version to download (e.g. latest, 1.21.4, 1.20.4).',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string|max:20',
      },
      {
        name: 'Paper Build',
        env_variable: 'BUILD_NUMBER',
        default_value: 'latest',
        description_de: 'Spezifische Build-Nummer oder "latest" für die neueste Version.',
        description_en: 'Specific build number or "latest" for the newest version.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string|max:20',
      },
    ],
  },
  {
    id: 'egg-rust-dedicated',
    slug: 'rust-dedicated',
    name: 'Rust — Dedicated Server (Carbon/Oxide)',
    category: 'games',
    subCategory: 'Rust',
    author: 'PteroNext Core Team',
    version: '2026.10',
    downloads: 9812,
    stars: 418,
    verified: true,
    file_size: '3.8 KB',
    description_de: 'Automatisierter Rust Dedicated Server mit optionalem Carbon/Oxide Plugin-Support, automatischer SteamCMD-Aktualisierung und RCON-Überwachung.',
    description_en: 'Automated Rust Dedicated Server with optional Carbon/Oxide modding frameworks, automated SteamCMD updates, and real-time RCON sync.',
    docker_image: 'ghcr.io/pterodactyl/games:rust',
    startup: './RustDedicated -batchmode +server.ip 0.0.0.0 +server.port {{SERVER_PORT}} +server.level "{{LEVEL}}" +server.seed {{SERVER_SEED}} +server.worldsize {{WORLD_SIZE}} +server.maxplayers {{MAX_PLAYERS}} +server.hostname "{{SERVER_NAME}}"',
    stop: 'quit',
    features: ['steam_cmd', 'carbon_oxide', 'rcon'],
    variables: [
      {
        name: 'Server Name',
        env_variable: 'SERVER_NAME',
        default_value: 'PteroNext Rust Server',
        description_de: 'Der Name des Rust-Servers in der öffentlichen Serverliste.',
        description_en: 'The public hostname of the Rust server.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
      },
      {
        name: 'World Size',
        env_variable: 'WORLD_SIZE',
        default_value: '3500',
        description_de: 'Weltgröße der prozeduralen Karte (1000 - 6000).',
        description_en: 'World size of the procedural map (1000 - 6000).',
        user_viewable: true,
        user_editable: true,
        rules: 'required|numeric|between:1000,6000',
      },
      {
        name: 'Map Seed',
        env_variable: 'SERVER_SEED',
        default_value: '1337',
        description_de: 'Seed-Wert für die prozedurale Kartengenerierung.',
        description_en: 'Map seed for procedural world generation.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|numeric',
      },
    ],
  },
  {
    id: 'egg-palworld',
    slug: 'palworld-dedicated',
    name: 'Palworld — Dedicated Server',
    category: 'games',
    subCategory: 'Palworld',
    author: 'PteroNext Ecosystem',
    version: '0.3.8',
    downloads: 8740,
    stars: 362,
    verified: true,
    file_size: '3.5 KB',
    description_de: 'Offizieller Palworld Linux Dedicated Server mit automatischem Speicher-Garbage-Collector und integriertem Crash-Watchdog.',
    description_en: 'Official Palworld Linux Dedicated Server with auto-restart memory cleanup routines and integrated crash watchdogs.',
    docker_image: 'ghcr.io/pterodactyl/games:palworld',
    startup: './PalServer.sh -port={{SERVER_PORT}} -players={{MAX_PLAYERS}} -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS',
    stop: 'shutdown 5',
    features: ['steam_cmd', 'multi_threading', 'memory_watchdog'],
    variables: [
      {
        name: 'Server Name',
        env_variable: 'SERVER_NAME',
        default_value: 'PteroNext Palworld Realm',
        description_de: 'Anzeigename des Palworld-Servers.',
        description_en: 'Display name of the Palworld server.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
      },
      {
        name: 'Max Players',
        env_variable: 'MAX_PLAYERS',
        default_value: '32',
        description_de: 'Maximale gleichzeitige Spielerzahl.',
        description_en: 'Maximum concurrent players.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|numeric|between:2,64',
      },
    ],
  },
  {
    id: 'egg-enshrouded',
    slug: 'enshrouded-dedicated',
    name: 'Enshrouded — Dedicated Server (Proton)',
    category: 'games',
    subCategory: 'Enshrouded',
    author: 'PteroNext Ecosystem',
    version: '1.0.4',
    downloads: 4120,
    stars: 189,
    verified: true,
    file_size: '3.4 KB',
    description_de: 'Enshrouded Dedicated Server via Valve Proton/Wine mit automatischer Konfigurations-Injektion und SteamCMD-Update beim Start.',
    description_en: 'Enshrouded Dedicated Server running through Valve Proton/Wine with automated config injection and SteamCMD startup synchronization.',
    docker_image: 'ghcr.io/pterodactyl/games:proton',
    startup: './enshrouded_server.exe -log',
    stop: '^C',
    features: ['wine_proton', 'steam_cmd'],
    variables: [
      {
        name: 'Server Name',
        env_variable: 'SERVER_NAME',
        default_value: 'Enshrouded Adventure',
        description_de: 'Servername für die Serverliste.',
        description_en: 'Server display name in the browser.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
      },
      {
        name: 'Server Password',
        env_variable: 'SERVER_PASSWORD',
        default_value: '',
        description_de: 'Zugangspasswort (leer für öffentlich).',
        description_en: 'Join password (leave blank for public access).',
        user_viewable: true,
        user_editable: true,
        rules: 'nullable|string',
      },
    ],
  },
  {
    id: 'egg-discord-nodejs',
    slug: 'discord-bot-nodejs',
    name: 'Discord Bot — Node.js & Discord.js v14',
    category: 'bots',
    subCategory: 'Node.js',
    author: 'PteroNext Bots Team',
    version: 'Node 22 / Discord.js v14',
    downloads: 12500,
    stars: 489,
    verified: true,
    file_size: '2.9 KB',
    description_de: 'Optimales Template für Discord.js v14 Bots mit Node.js 22 LTS, npm/yarn/pnpm Unterstützung, Auto-Build von nativen Modulen und Live-Console.',
    description_en: 'Production-ready runtime for modern Discord.js v14 bots using Node.js 22 LTS, npm/yarn/pnpm package managers, and native build tools.',
    docker_image: 'ghcr.io/pterodactyl/yolks:nodejs_22',
    startup: 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -d node_modules ]]; then npm install; fi; node {{BOT_JSFILE}}',
    stop: '^C',
    features: ['git_autoupdate', 'npm_auto_install', 'native_addons'],
    variables: [
      {
        name: 'Main Bot File',
        env_variable: 'BOT_JSFILE',
        default_value: 'index.js',
        description_de: 'Einstiegspunkt des Node.js Bots (z. B. index.js, bot.js, dist/index.js).',
        description_en: 'Main executable entrypoint (e.g. index.js, bot.js, dist/index.js).',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
      },
      {
        name: 'Auto Git Pull',
        env_variable: 'AUTO_UPDATE',
        default_value: '0',
        description_de: 'Beim Serverstart automatisch "git pull" ausführen (0 = Deaktiviert, 1 = Aktiviert).',
        description_en: 'Run "git pull" on server startup (0 = disabled, 1 = enabled).',
        user_viewable: true,
        user_editable: true,
        rules: 'required|boolean',
      },
    ],
  },
  {
    id: 'egg-discord-python',
    slug: 'discord-bot-python',
    name: 'Discord Bot — Python 3.12 (discord.py / disnake)',
    category: 'bots',
    subCategory: 'Python',
    author: 'PteroNext Bots Team',
    version: 'Python 3.12',
    downloads: 7890,
    stars: 310,
    verified: true,
    file_size: '2.8 KB',
    description_de: 'Python 3.12 Laufzeitumgebung für discord.py, disnake, hikari und Nextcord mit automatischer requirements.txt Installation beim Container-Start.',
    description_en: 'Python 3.12 application environment for discord.py, disnake, hikari, and Nextcord with automatic pip requirements.txt synchronization.',
    docker_image: 'ghcr.io/pterodactyl/yolks:python_3.12',
    startup: 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ -f requirements.txt ]]; then pip install -r requirements.txt; fi; python3 -u {{MAIN_FILE}}',
    stop: '^C',
    features: ['git_autoupdate', 'pip_requirements', 'unbuffered_output'],
    variables: [
      {
        name: 'Main Script File',
        env_variable: 'MAIN_FILE',
        default_value: 'main.py',
        description_de: 'Hauptdatei des Python-Bots (z. B. main.py, bot.py).',
        description_en: 'Primary Python script entrypoint.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
      },
      {
        name: 'Auto Git Update',
        env_variable: 'AUTO_UPDATE',
        default_value: '0',
        description_de: 'Automatische Git-Synchronisation beim Start.',
        description_en: 'Pull newest git commits on boot.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|boolean',
      },
    ],
  },
  {
    id: 'egg-caddy-proxy',
    slug: 'caddy-reverse-proxy',
    name: 'Caddy — Modern HTTP/3 Reverse Proxy',
    category: 'web',
    subCategory: 'Caddy',
    author: 'PteroNext Infrastructure Team',
    version: '2.8.4',
    downloads: 6420,
    stars: 295,
    verified: true,
    file_size: '2.5 KB',
    description_de: 'Caddy 2 Reverse Proxy mit automatischer TLS-Zertifikatsverwaltung via Let\'s Encrypt / ZeroSSL, HTTP/3 QUIC Support und einfacher Caddyfile-Syntax.',
    description_en: 'Caddy 2 web server and reverse proxy featuring automatic TLS via Let\'s Encrypt / ZeroSSL, native HTTP/3 QUIC support, and intuitive Caddyfile configuration.',
    docker_image: 'caddy:2.8-alpine',
    startup: 'caddy run --config {{CADDYFILE_PATH}} --adapter caddyfile',
    stop: '^C',
    features: ['http3_quic', 'auto_https', 'alpine_lightweight'],
    variables: [
      {
        name: 'Caddyfile Path',
        env_variable: 'CADDYFILE_PATH',
        default_value: 'Caddyfile',
        description_de: 'Pfad zur Konfigurationsdatei im Server-Verzeichnis.',
        description_en: 'Path to Caddyfile relative to server root.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
      },
    ],
  },
  {
    id: 'egg-go-api',
    slug: 'go-rest-api',
    name: 'Go — High Performance Gin/Fiber API',
    category: 'web',
    subCategory: 'Go',
    author: 'PteroNext Cloud Team',
    version: 'Go 1.23',
    downloads: 5120,
    stars: 260,
    verified: true,
    file_size: '2.6 KB',
    description_de: 'Kompilierte Go-Microservices oder Live-Reload mit Air. Extrem geringer RAM-Footprint und native Linux amd64 Performance.',
    description_en: 'Compiled Go microservices or live-reload development via Air. Ultra-low memory footprint and bare-metal Linux performance.',
    docker_image: 'ghcr.io/pterodactyl/yolks:go_1.23',
    startup: 'if [[ -f go.mod ]]; then go mod download; fi; if [[ -f main.go ]]; then go run main.go; else ./{{EXECUTABLE_NAME}}; fi',
    stop: '^C',
    features: ['zero_overhead', 'go_modules', 'fast_rebuild'],
    variables: [
      {
        name: 'Executable Binary',
        env_variable: 'EXECUTABLE_NAME',
        default_value: 'server',
        description_de: 'Name des kompilierten Binaries (falls main.go nicht vorhanden).',
        description_en: 'Binary name if running a precompiled release.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
      },
    ],
  },
  {
    id: 'egg-nextjs',
    slug: 'nextjs-web-stack',
    name: 'Next.js — SSR & Fullstack React',
    category: 'web',
    subCategory: 'Next.js',
    author: 'PteroNext Web Team',
    version: 'Next 15 / React 19',
    downloads: 8930,
    stars: 388,
    verified: true,
    file_size: '3.1 KB',
    description_de: 'Modernes Node.js 22 Runtime-Environment für Next.js Standalone-Deployments mit automatischer Portbindung und gzip/brotli Komprimierung.',
    description_en: 'Optimized Node.js 22 environment for standalone Next.js production deployments with port binding and asset acceleration.',
    docker_image: 'ghcr.io/pterodactyl/yolks:nodejs_22',
    startup: 'npm start -- -p {{SERVER_PORT}}',
    stop: '^C',
    features: ['react19', 'next15_standalone', 'turbo_ready'],
    variables: [
      {
        name: 'Port Binding',
        env_variable: 'PORT',
        default_value: '3000',
        description_de: 'Lokaler Web-Port des Next.js Daemons.',
        description_en: 'Local web listening port for Next.js.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|numeric',
      },
    ],
  },
  {
    id: 'egg-postgres-16',
    slug: 'postgres-16',
    name: 'PostgreSQL — Relational SQL Engine 16',
    category: 'databases',
    subCategory: 'Postgres',
    author: 'PteroNext Database Ops',
    version: '16.4 Alpine',
    downloads: 11400,
    stars: 520,
    verified: true,
    file_size: '3.2 KB',
    description_de: 'Robuste PostgreSQL 16 Datenbankinstanz auf Basis von Alpine Linux mit konfigurierbarem shared_buffers Tuning und UTF-8 Encoding.',
    description_en: 'Production-ready PostgreSQL 16 database running on lightweight Alpine Linux with configurable buffer cache and strict UTF-8 locale.',
    docker_image: 'postgres:16-alpine',
    startup: 'docker-entrypoint.sh postgres -p {{SERVER_PORT}}',
    stop: '^C',
    features: ['acid_compliant', 'alpine_lightweight', 'wal_protection'],
    variables: [
      {
        name: 'Database Name',
        env_variable: 'POSTGRES_DB',
        default_value: 'pteronext',
        description_de: 'Standard-Datenbankname beim Initialisieren.',
        description_en: 'Initial database name created on startup.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
      },
      {
        name: 'Admin Username',
        env_variable: 'POSTGRES_USER',
        default_value: 'postgres',
        description_de: 'Name des PostgreSQL-Hauptbenutzers.',
        description_en: 'Default administrative database superuser.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
      },
      {
        name: 'Admin Password',
        env_variable: 'POSTGRES_PASSWORD',
        default_value: 'ChangeMeSecret123!',
        description_de: 'Passwort des Datenbank-Hauptbenutzers.',
        description_en: 'Superuser authentication password.',
        user_viewable: false,
        user_editable: true,
        rules: 'required|string|min:8',
      },
    ],
  },
  {
    id: 'egg-redis-7',
    slug: 'redis-7-cache',
    name: 'Redis — In-Memory Key/Value & PubSub 7',
    category: 'databases',
    subCategory: 'Redis',
    author: 'PteroNext Database Ops',
    version: '7.4 Alpine',
    downloads: 13950,
    stars: 610,
    verified: true,
    file_size: '2.7 KB',
    description_de: 'Ultraschneller Redis 7 In-Memory Cache mit optionaler AOF-Persistenz, Passwort-Authentifizierung und benutzerdefinierter maxmemory-Policy.',
    description_en: 'Blazing fast Redis 7 in-memory cache and message broker with optional AOF durability, password protection, and eviction tuning.',
    docker_image: 'redis:7-alpine',
    startup: 'redis-server --port {{SERVER_PORT}} --requirepass "{{REDIS_PASSWORD}}" --appendonly yes',
    stop: '^C',
    features: ['in_memory', 'pub_sub', 'aof_durability'],
    variables: [
      {
        name: 'Redis Password',
        env_variable: 'REDIS_PASSWORD',
        default_value: 'RedisSecretPass2026',
        description_de: 'Zugangspasswort für Redis-Clients (AUTH).',
        description_en: 'Client authentication secret.',
        user_viewable: false,
        user_editable: true,
        rules: 'required|string|min:6',
      },
    ],
  },
  {
    id: 'egg-pocketbase',
    slug: 'pocketbase-backend',
    name: 'PocketBase — Open Source Realtime Backend',
    category: 'databases',
    subCategory: 'PocketBase',
    author: 'PteroNext Cloud Team',
    version: '0.23.4',
    downloads: 4890,
    stars: 245,
    verified: true,
    file_size: '2.8 KB',
    description_de: 'Echtzeit-Backend in einer einzelnen Go-Binary mit integrierter SQLite-Datenbank, File-Storage, Realtime-Abonnements und Web-Admin-Dashboard.',
    description_en: 'Real-time backend packaged in a single Go binary with embedded SQLite, file storage, realtime subscriptions, and an elegant admin UI.',
    docker_image: 'ghcr.io/pterodactyl/yolks:debian',
    startup: './pocketbase serve --http="0.0.0.0:{{SERVER_PORT}}"',
    stop: '^C',
    features: ['single_binary_go', 'embedded_sqlite', 'realtime_subscriptions'],
    variables: [
      {
        name: 'PocketBase Version',
        env_variable: 'POCKETBASE_VERSION',
        default_value: '0.23.4',
        description_de: 'Zu installierende Release-Version von PocketBase.',
        description_en: 'Target release version to download.',
        user_viewable: true,
        user_editable: true,
        rules: 'required|string',
      },
    ],
  },
];

/**
 * Builds an authentic Pterodactyl / PteroNext Egg PTDL_v2 JSON export structure
 */
export function buildEggExportJson(egg: MarketplaceEgg): string {
  // If the egg already has a raw egg_json, return it
  if (egg.egg_json) {
    if (typeof egg.egg_json === 'string') {
      try {
        JSON.parse(egg.egg_json);
        return egg.egg_json;
      } catch {
        // invalid string, fall through to build structure
      }
    } else {
      return JSON.stringify(egg.egg_json, null, 2);
    }
  }

  const exportObj = {
    _comment: 'DO NOT EDIT THIS FILE. THIS IS A PTERONEXT EGG EXPORT FORMAT.',
    meta: {
      version: 'PTDL_v2',
      update_url: null,
    },
    exported_at: new Date().toISOString(),
    name: egg.name,
    author: egg.author || egg.author_name || 'support@pteronext.com',
    description: egg.description_en || egg.description_de || '',
    features: egg.features || [],
    docker_images: {
      [egg.docker_image]: egg.docker_image,
    },
    file_denylist: [],
    startup: egg.startup || egg.startup_command || 'echo "Server starting..."',
    config: {
      files: {},
      startup: {
        done: 'Server marked as running',
        userInteraction: [],
      },
      stop: egg.stop || '^C',
      logs: {},
    },
    scripts: {
      installation: {
        script: `#!/bin/bash\n# PteroNext automated egg installation routine\necho "Initializing container setup for ${egg.name}..."\nexit 0\n`,
        container: egg.docker_image || 'ghcr.io/pterodactyl/installers:alpine',
        entrypoint: 'bash',
      },
    },
    variables: (egg.variables || []).map((v) => ({
      name: v.name,
      description: v.description_en || v.description_de || '',
      env_variable: v.env_variable,
      default_value: v.default_value,
      user_viewable: v.user_viewable ?? true,
      user_editable: v.user_editable ?? true,
      rules: v.rules || 'nullable|string',
      field_type: 'text',
    })),
  };

  return JSON.stringify(exportObj, null, 2);
}

/**
 * Fetches approved eggs from the PteroNext Ecosystem Store API (https://pteronext.com/api/marketplace/eggs?status=approved).
 * Gracefully falls back to curated verified eggs if offline or endpoint is unavailable.
 */
export async function fetchMarketplaceEggs(): Promise<MarketplaceEgg[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch('https://pteronext.com/api/marketplace/eggs?status=approved', {
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      let remoteEggs: any[] = [];
      if (Array.isArray(data)) {
        remoteEggs = data;
      } else if (Array.isArray(data.data)) {
        remoteEggs = data.data;
      } else if (Array.isArray(data.eggs)) {
        remoteEggs = data.eggs;
      }

      if (remoteEggs.length > 0) {
        // Map and normalize remote eggs
        const mappedRemote: MarketplaceEgg[] = remoteEggs.map((item) => {
          let cat: 'games' | 'bots' | 'web' | 'databases' = 'games';
          const rawCat = (item.category || '').toLowerCase();
          if (rawCat.includes('bot') || rawCat.includes('discord')) cat = 'bots';
          else if (rawCat.includes('web') || rawCat.includes('proxy') || rawCat.includes('stack')) cat = 'web';
          else if (rawCat.includes('data') || rawCat.includes('sql') || rawCat.includes('redis')) cat = 'databases';
          else if (rawCat.includes('game')) cat = 'games';

          return {
            id: item.id || `remote-${item.slug || Math.random().toString(36).substring(7)}`,
            slug: item.slug || item.id,
            name: item.name,
            category: cat,
            subCategory: item.subCategory || item.category,
            author: item.author_name || item.author || 'Community Contributor',
            author_name: item.author_name || item.author,
            version: item.version || '1.0.0',
            downloads: item.downloads_count ?? item.downloads ?? 120,
            downloads_count: item.downloads_count ?? item.downloads ?? 120,
            stars: item.stars ?? 45,
            verified: item.verified ?? true,
            description_de: item.description_de || item.description || item.description_en || '',
            description_en: item.description_en || item.description || item.description_de || '',
            docker_image: item.docker_image || 'ghcr.io/pterodactyl/yolks:debian',
            startup: item.startup_command || item.startup || '',
            startup_command: item.startup_command || item.startup,
            stop: item.stop || '^C',
            variables: item.variables || [],
            egg_json: item.egg_json,
          };
        });

        // Merge remote with curated (remote eggs first, avoiding duplicates by slug)
        const remoteSlugs = new Set(mappedRemote.map((e) => e.slug));
        const filteredCurated = CURATED_MARKETPLACE_EGGS.filter((e) => !remoteSlugs.has(e.slug));
        return [...mappedRemote, ...filteredCurated];
      }
    }
  } catch (err) {
    // Network error or timeout: seamlessly fall back to curated catalogue
    console.info('[PteroNext Marketplace] Remote store offline/unreachable, using curated catalog cache.', err);
  }

  return CURATED_MARKETPLACE_EGGS;
}
