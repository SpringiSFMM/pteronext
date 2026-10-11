export interface EggVariable {
  name: string;
  env_variable: string;
  default_value: string;
  description: string;
  user_viewable: boolean;
  user_editable: boolean;
  rules?: string;
}

export interface Egg {
  id: string;
  nestId: string;
  name: string;
  tag: string;
  description: string;
  dockerImage: string;
  startup: string;
  defaultPort: number;
  category: 'Gaming' | 'Database' | 'Applications' | 'Infrastructure';
  variables: EggVariable[];
}

export interface Nest {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  eggs: Egg[];
}

export const nestsData: Nest[] = [
  {
    id: 'nest-minecraft',
    name: 'Minecraft',
    slug: 'minecraft',
    description: 'Block-building sandbox game servers, modded runtimes and proxies',
    icon: 'Box',
    eggs: [
      {
        id: 'egg-paper',
        nestId: 'nest-minecraft',
        name: 'Paper',
        tag: 'paper',
        description: 'High performance Minecraft server software with comprehensive plugin support and optimizations.',
        dockerImage: 'ghcr.io/pterodactyl/yolks:java_21',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}} nogui',
        defaultPort: 25565,
        category: 'Gaming',
        variables: [
          {
            name: 'Minecraft Version',
            env_variable: 'MINECRAFT_VERSION',
            default_value: '1.21.1',
            description: 'The version of Minecraft to download and run (e.g. latest, 1.21.1, 1.20.4).',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Server Jar File',
            env_variable: 'SERVER_JARFILE',
            default_value: 'paper.jar',
            description: 'The executable jarfile name for the PaperMC runtime.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Paper Build Number',
            env_variable: 'BUILD_NUMBER',
            default_value: 'latest',
            description: 'The specific Paper build number to download, or "latest" for newest stable release.',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
      {
        id: 'egg-vanilla',
        nestId: 'nest-minecraft',
        name: 'Vanilla',
        tag: 'vanilla',
        description: 'The official, unmodified Minecraft server software maintained directly by Mojang Studios.',
        dockerImage: 'ghcr.io/pterodactyl/yolks:java_21',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}} nogui',
        defaultPort: 25565,
        category: 'Gaming',
        variables: [
          {
            name: 'Minecraft Version',
            env_variable: 'MINECRAFT_VERSION',
            default_value: 'latest',
            description: 'Official Minecraft server release version (e.g. latest, 1.21.1).',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Server Jar File',
            env_variable: 'SERVER_JARFILE',
            default_value: 'server.jar',
            description: 'The filename of the executable Mojang server jar.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Accept EULA',
            env_variable: 'EULA',
            default_value: 'true',
            description: 'Acknowledge and accept Mojang End User License Agreement (true/false).',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
      {
        id: 'egg-forge',
        nestId: 'nest-minecraft',
        name: 'Forge',
        tag: 'forge',
        description: 'Standard modding platform and loader supporting thousands of custom community modpacks.',
        dockerImage: 'ghcr.io/pterodactyl/yolks:java_21',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}} nogui',
        defaultPort: 25565,
        category: 'Gaming',
        variables: [
          {
            name: 'Minecraft Version',
            env_variable: 'MC_VERSION',
            default_value: '1.20.1',
            description: 'Base Minecraft release targeted for Forge installation.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Forge Version',
            env_variable: 'FORGE_VERSION',
            default_value: '47.2.0',
            description: 'Specific Forge loader build number to download and install.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Server Jar File',
            env_variable: 'SERVER_JARFILE',
            default_value: 'forge-server.jar',
            description: 'Forge server bootstrapper executable jar name.',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
      {
        id: 'egg-fabric',
        nestId: 'nest-minecraft',
        name: 'Fabric',
        tag: 'fabric',
        description: 'Lightweight, modular modding toolchain focusing on rapid version updates and performance.',
        dockerImage: 'ghcr.io/pterodactyl/yolks:java_21',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}} nogui',
        defaultPort: 25565,
        category: 'Gaming',
        variables: [
          {
            name: 'Minecraft Version',
            env_variable: 'MINECRAFT_VERSION',
            default_value: '1.21.1',
            description: 'Minecraft game version.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Fabric Loader Version',
            env_variable: 'FABRIC_VERSION',
            default_value: 'latest',
            description: 'Fabric loader release version or "latest".',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Server Jar File',
            env_variable: 'SERVER_JARFILE',
            default_value: 'fabric-server-launch.jar',
            description: 'Executable Fabric server launcher file.',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
    ],
  },
  {
    id: 'nest-rust',
    name: 'Rust',
    slug: 'rust',
    description: 'Post-apocalyptic multiplayer survival sandbox with Oxide/uMod support',
    icon: 'Flame',
    eggs: [
      {
        id: 'egg-rust-dedicated',
        nestId: 'nest-rust',
        name: 'Rust Dedicated',
        tag: 'rust-dedicated',
        description: 'Facepunch Rust dedicated multiplayer server with procedural world generation and Oxide support.',
        dockerImage: 'ghcr.io/pterodactyl/games:rust',
        startup: './RustDedicated -batchmode +server.port {{SERVER_PORT}} +server.identity "pteronext" +server.hostname "{{SERVER_NAME}}" +server.maxplayers {{MAX_PLAYERS}} +server.worldsize {{WORLD_SIZE}} +server.seed {{SEED}}',
        defaultPort: 28015,
        category: 'Gaming',
        variables: [
          {
            name: 'Server Hostname',
            env_variable: 'SERVER_NAME',
            default_value: 'CyberRust Survival | High Performance',
            description: 'The public server name displayed in the Rust server browser.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Max Players',
            env_variable: 'MAX_PLAYERS',
            default_value: '50',
            description: 'Maximum concurrent player slots.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'World Map Size',
            env_variable: 'WORLD_SIZE',
            default_value: '3500',
            description: 'Procedural map world size in meters (typically 1000 - 6000).',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'World Seed',
            env_variable: 'SEED',
            default_value: '84920',
            description: 'Map generation seed number for terrain features.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Oxide / uMod Support',
            env_variable: 'OXIDE',
            default_value: '1',
            description: 'Enable Oxide/uMod modding framework (1 = enabled, 0 = vanilla).',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
    ],
  },
  {
    id: 'nest-source',
    name: 'Steam & Source',
    slug: 'source',
    description: 'Valve Source and Source 2 engine multiplayer game servers',
    icon: 'Crosshair',
    eggs: [
      {
        id: 'egg-cs2',
        nestId: 'nest-source',
        name: 'Counter-Strike 2',
        tag: 'cs2',
        description: 'Next-generation tactical competitive FPS on the Source 2 engine.',
        dockerImage: 'ghcr.io/pterodactyl/games:source',
        startup: './cs2 -dedicated +ip 0.0.0.0 -port {{SERVER_PORT}} +map {{SRCDS_MAP}} +maxplayers {{MAX_PLAYERS}}',
        defaultPort: 27015,
        category: 'Gaming',
        variables: [
          {
            name: 'Default Map',
            env_variable: 'SRCDS_MAP',
            default_value: 'de_dust2',
            description: 'Initial map loaded on server startup (e.g. de_dust2, de_mirage, de_inferno).',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Max Players',
            env_variable: 'MAX_PLAYERS',
            default_value: '16',
            description: 'Maximum player capacity.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Steam GSLT Token',
            env_variable: 'GSLT',
            default_value: '',
            description: 'Game Server Login Token registered on steamcommunity.com.',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
      {
        id: 'egg-tf2',
        nestId: 'nest-source',
        name: 'Team Fortress 2',
        tag: 'tf2',
        description: 'Team-based class combat shooter with custom map rotation.',
        dockerImage: 'ghcr.io/pterodactyl/games:source',
        startup: './srcds_run -game tf -console -port {{SERVER_PORT}} +map {{SRCDS_MAP}} +maxplayers {{MAX_PLAYERS}}',
        defaultPort: 27015,
        category: 'Gaming',
        variables: [
          {
            name: 'Default Map',
            env_variable: 'SRCDS_MAP',
            default_value: 'cp_badlands',
            description: 'First map loaded when server starts.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Max Players',
            env_variable: 'MAX_PLAYERS',
            default_value: '24',
            description: 'Maximum player slots.',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
    ],
  },
  {
    id: 'nest-database',
    name: 'Databases',
    slug: 'databases',
    description: 'Relational, document, and key-value persistent storage engines',
    icon: 'Database',
    eggs: [
      {
        id: 'egg-postgres',
        nestId: 'nest-database',
        name: 'PostgreSQL 16',
        tag: 'postgres-16',
        description: 'Enterprise open-source relational SQL database system with JSON and ACID support.',
        dockerImage: 'postgres:16-alpine',
        startup: 'docker-entrypoint.sh postgres',
        defaultPort: 5432,
        category: 'Database',
        variables: [
          {
            name: 'Database Name',
            env_variable: 'POSTGRES_DB',
            default_value: 'pteronext_db',
            description: 'Default database created upon first container initialization.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Database User',
            env_variable: 'POSTGRES_USER',
            default_value: 'postgres',
            description: 'Superuser username for database authentication.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Database Password',
            env_variable: 'POSTGRES_PASSWORD',
            default_value: 'CyberPteroDbSecret_99',
            description: 'Superuser password for PostgreSQL access.',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
      {
        id: 'egg-redis',
        nestId: 'nest-database',
        name: 'Redis 7.2',
        tag: 'redis-7',
        description: 'Ultra-fast in-memory key-value data store used for caches and pub/sub queues.',
        dockerImage: 'redis:7-alpine',
        startup: 'redis-server --requirepass {{REDIS_PASSWORD}} --port {{SERVER_PORT}}',
        defaultPort: 6379,
        category: 'Database',
        variables: [
          {
            name: 'Redis Password',
            env_variable: 'REDIS_PASSWORD',
            default_value: 'RedisSecretKey_2026',
            description: 'Requirepass authentication string for Redis client connections.',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
    ],
  },
  {
    id: 'nest-apps',
    name: 'Web & Runtimes',
    slug: 'apps',
    description: 'Modern development runtimes for APIs, workers, bots and scripts',
    icon: 'Terminal',
    eggs: [
      {
        id: 'egg-nodejs',
        nestId: 'nest-apps',
        name: 'Node.js 22 LTS',
        tag: 'nodejs-22',
        description: 'High performance JavaScript / TypeScript backend runtime powered by V8 engine.',
        dockerImage: 'node:22-alpine',
        startup: 'node {{MAIN_FILE}}',
        defaultPort: 3000,
        category: 'Applications',
        variables: [
          {
            name: 'Entrypoint File',
            env_variable: 'MAIN_FILE',
            default_value: 'index.js',
            description: 'The JavaScript/TypeScript entrypoint file executed on launch.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Node Environment',
            env_variable: 'NODE_ENV',
            default_value: 'production',
            description: 'Application environment mode (production or development).',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
      {
        id: 'egg-python',
        nestId: 'nest-apps',
        name: 'Python 3.12',
        tag: 'python-312',
        description: 'Modern Python runtime suitable for FastAPI, Flask, Discord bots, and data scripts.',
        dockerImage: 'python:3.12-slim',
        startup: 'python3 {{MAIN_FILE}}',
        defaultPort: 8000,
        category: 'Applications',
        variables: [
          {
            name: 'Entrypoint Script',
            env_variable: 'MAIN_FILE',
            default_value: 'app.py',
            description: 'The main Python script to launch with the interpreter.',
            user_viewable: true,
            user_editable: true,
          },
          {
            name: 'Requirements File',
            env_variable: 'REQUIREMENTS_FILE',
            default_value: 'requirements.txt',
            description: 'Dependencies list installed automatically before startup.',
            user_viewable: true,
            user_editable: true,
          },
        ],
      },
    ],
  },
];
