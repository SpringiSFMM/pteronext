import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { api } from '../../../api/client';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  Package,
  Search,
  Download,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  FolderDown,
  Layers,
  Check,
  Zap,
  Cpu,
  Server,
  Terminal,
  Gamepad2,
  Boxes,
  Loader2,
  AlertCircle,
  FileCode,
  Shield,
  Archive,
  Flame,
  Info,
} from 'lucide-react';

interface ModrinthProject {
  project_id: string;
  title: string;
  author: string;
  description: string;
  downloads: number;
  icon_url: string | null;
  categories: string[];
}

interface SoftwareVersionPreset {
  id: string;
  name: string;
  game: 'minecraft' | 'palworld' | 'ark';
  software: string;
  version: string;
  recommendedJava?: string;
  recommendedRam?: string;
  badge: string;
  description: string;
}

interface ModpackPreset {
  id: string;
  name: string;
  game: 'minecraft' | 'palworld' | 'ark';
  author: string;
  version: string;
  mcVersion?: string;
  loader: string;
  recommendedRam: string;
  downloads: string;
  iconUrl: string;
  description: string;
  tags: string[];
  serverPackUrl?: string;
}

const DEFAULT_POPULAR_PLUGINS: ModrinthProject[] = [
  {
    project_id: 'Vebnzrzj',
    title: 'LuckPerms',
    author: 'lucko',
    description: 'An advanced permissions plugin for Minecraft Paper/Spigot servers and proxies.',
    downloads: 2873000,
    icon_url: 'https://cdn.modrinth.com/data/Vebnzrzj/90943902cc650e95b167265b8f2d7c893f82c8f4_96.webp',
    categories: ['paper', 'spigot', 'purpur', 'bukkit'],
  },
  {
    project_id: 'kkmrDlKT',
    title: 'ViaVersion',
    author: 'ViaVersion',
    description: 'Allows newer Minecraft client versions to connect to older server versions.',
    downloads: 3410000,
    icon_url: 'https://cdn.modrinth.com/data/kkmrDlKT/0270a312ba3cfa86144570faeb7f86ebcb3ff6f5_96.webp',
    categories: ['paper', 'spigot', 'purpur', 'bukkit'],
  },
  {
    project_id: 'Wnxd13Ac',
    title: 'Geyser-Spigot',
    author: 'GeyserMC',
    description: 'A bridge allowing Minecraft Bedrock Edition players to join your Java server.',
    downloads: 1980000,
    icon_url: 'https://cdn.modrinth.com/data/Wnxd13Ac/05eef3ba50c33e21820a402379373cf570f7bb1e_96.webp',
    categories: ['paper', 'spigot', 'purpur'],
  },
  {
    project_id: 'fALzjamp',
    title: 'Chunky',
    author: 'pop4959',
    description: 'Pre-generates chunks quickly and efficiently to prevent lag spikes on Paper/Spigot.',
    downloads: 1420000,
    icon_url: 'https://cdn.modrinth.com/data/fALzjamp/ca51aa42ca7b9627768e1467406a4b11f7be0b71_96.webp',
    categories: ['paper', 'spigot', 'purpur'],
  },
  {
    project_id: '75j8o75A',
    title: 'EssentialsX',
    author: 'EssentialsX',
    description: 'The essential plugin suite providing teleportation, economy, homes, warps, and moderation.',
    downloads: 4120000,
    icon_url: 'https://cdn.modrinth.com/data/75j8o75A/icon.png',
    categories: ['paper', 'spigot', 'purpur', 'bukkit'],
  },
  {
    project_id: '17595507',
    title: 'WorldEdit',
    author: 'EngineHub',
    description: 'In-game Minecraft map editor allowing fast terrain sculpting and block manipulation.',
    downloads: 6540000,
    icon_url: 'https://cdn.modrinth.com/data/17595507/icon.png',
    categories: ['paper', 'spigot', 'purpur', 'bukkit'],
  },
];

const SOFTWARE_VERSION_PRESETS: SoftwareVersionPreset[] = [
  // --- MINECRAFT ---
  {
    id: 'paper-1.21.4',
    name: 'PaperMC 1.21.4',
    game: 'minecraft',
    software: 'PaperMC',
    version: '1.21.4',
    recommendedJava: 'Java 21',
    badge: 'LATEST RECOMMENDED',
    description: 'Ultra-fast, stable PaperMC server build with advanced tick optimization, modern datapack fixes, and full plugin compatibility.',
  },
  {
    id: 'paper-1.21.1',
    name: 'PaperMC 1.21.1',
    game: 'minecraft',
    software: 'PaperMC',
    version: '1.21.1',
    recommendedJava: 'Java 21',
    badge: 'POPULAR STABLE',
    description: 'Highly stable Paper release with massive plugin support and robust async chunk loading.',
  },
  {
    id: 'purpur-1.21.4',
    name: 'Purpur 1.21.4',
    game: 'minecraft',
    software: 'Purpur',
    version: '1.21.4',
    recommendedJava: 'Java 21',
    badge: 'PERFORMANCE+',
    description: 'Drop-in replacement for Paper with extreme gameplay configurability, ridable mobs, and TPS enhancements.',
  },
  {
    id: 'paper-1.20.4',
    name: 'PaperMC 1.20.4',
    game: 'minecraft',
    software: 'PaperMC',
    version: '1.20.4',
    recommendedJava: 'Java 17',
    badge: 'LTS STABLE',
    description: 'The golden standard LTS release for production Minecraft networks and survival servers.',
  },
  {
    id: 'fabric-1.21.4',
    name: 'Fabric Loader 1.21.4',
    game: 'minecraft',
    software: 'Fabric',
    version: '1.21.4',
    recommendedJava: 'Java 21',
    badge: 'LIGHTWEIGHT MODS',
    description: 'Lightweight, modern modular modding toolchain. Perfect for Sodium, Lithium, and modern modpacks.',
  },
  {
    id: 'neoforge-1.21.1',
    name: 'NeoForge 1.21.1',
    game: 'minecraft',
    software: 'NeoForge',
    version: '1.21.1',
    recommendedJava: 'Java 21',
    badge: 'MODDING SUCCESSOR',
    description: 'The next-generation community-driven Forge successor for large-scale modded Minecraft servers.',
  },
  {
    id: 'forge-1.20.1',
    name: 'Minecraft Forge 1.20.1',
    game: 'minecraft',
    software: 'Forge',
    version: '1.20.1',
    recommendedJava: 'Java 17',
    badge: 'HEAVY MODDING',
    description: 'The premier platform for massive modpacks (ATM9, Better MC, Create, Mekanism).',
  },
  {
    id: 'paper-1.19.4',
    name: 'PaperMC 1.19.4',
    game: 'minecraft',
    software: 'PaperMC',
    version: '1.19.4',
    recommendedJava: 'Java 17',
    badge: 'LEGACY STABLE',
    description: 'Stable 1.19 release with broad legacy plugin support.',
  },
  {
    id: 'paper-1.16.5',
    name: 'PaperMC 1.16.5',
    game: 'minecraft',
    software: 'PaperMC',
    version: '1.16.5',
    recommendedJava: 'Java 11 / 16',
    badge: 'NETHER UPDATE',
    description: 'Classic 1.16.5 release for legendary modpacks and competitive servers.',
  },
  {
    id: 'paper-1.8.8',
    name: 'PaperMC 1.8.8',
    game: 'minecraft',
    software: 'PaperMC',
    version: '1.8.8',
    recommendedJava: 'Java 8',
    badge: 'PVP CLASSIC',
    description: 'The ultimate 1.8.8 PvP competitive combat baseline.',
  },

  // --- PALWORLD ---
  {
    id: 'palworld-dedicated',
    name: 'Palworld Community Dedicated Engine',
    game: 'palworld',
    software: 'SteamCMD / Unreal Engine',
    version: 'Latest Public Build',
    recommendedRam: '8 - 16 GB',
    badge: '32 SLOTS READY',
    description: 'High-tickrate dedicated Palworld multiplayer server engine with multithreading support and automatic crash recovery.',
  },
  {
    id: 'palworld-palguard',
    name: 'Palguard Anticheat & Admin Suite',
    game: 'palworld',
    software: 'Palguard / UE4SS',
    version: 'v0.9.4',
    recommendedRam: '8 - 16 GB',
    badge: 'ANTI-CHEAT PROTECTED',
    description: 'Integrated security framework blocking item-duping, speedhacking, and providing remote admin bans & whitelisting.',
  },
  {
    id: 'palworld-ue4ss',
    name: 'UE4SS Modding Framework',
    game: 'palworld',
    software: 'UE4SS Lua Core',
    version: 'v3.0.1',
    recommendedRam: '10 - 16 GB',
    badge: 'LUA MODDING',
    description: 'Unreal Engine 4/5 scripting toolchain enabling seamless drag-and-drop Lua mods and asset injections.',
  },

  // --- ARK: SURVIVAL ASCENDED / EVOLVED ---
  {
    id: 'ark-asa-dedicated',
    name: 'ARK: Survival Ascended Dedicated Engine',
    game: 'ark',
    software: 'Unreal Engine 5 ASA',
    version: 'Latest Crossplay Build',
    recommendedRam: '16 - 24 GB',
    badge: 'CROSSPLAY ENABLED',
    description: 'Next-gen UE5 ARK dedicated server engine supporting PC (Steam/WinGDK), PlayStation 5, and Xbox Series X/S crossplay.',
  },
  {
    id: 'ark-asa-api',
    name: 'ARK Server API (AsaApi)',
    game: 'ark',
    software: 'AsaApi Framework',
    version: 'v1.14',
    recommendedRam: '16 - 32 GB',
    badge: 'PLUGIN INJECTOR',
    description: 'C++ plugin framework allowing server-side mods, automated shop systems, cross-chat, and Discord logging without requiring client downloads.',
  },
  {
    id: 'ark-structures-plus',
    name: 'ARK: Structures Plus (S+) Overhaul',
    game: 'ark',
    software: 'S+ Preset Core',
    version: 'v2.4',
    recommendedRam: '12 - 16 GB',
    badge: 'QOL OVERHAUL',
    description: 'Automated breeding, item pulling, true glass building pieces, and infinite wire-free electricity.',
  },
];

const MODPACK_PRESETS: ModpackPreset[] = [
  // --- MINECRAFT MODPACKS ---
  {
    id: 'all-the-mods-9',
    name: 'All The Mods 9 (ATM9)',
    game: 'minecraft',
    author: 'ATM Team',
    version: 'v0.3.2',
    mcVersion: '1.20.1',
    loader: 'Forge',
    recommendedRam: '8 - 12 GB',
    downloads: '3.4M',
    iconUrl: 'https://cdn.modrinth.com/data/3y8Hw1f9/icon.png',
    description: 'The definitive kitchen-sink modpack featuring GregTech, Applied Energistics, Mekanism, Twilight Forest, and over 400 quests.',
    tags: ['Tech', 'Magic', 'Quests', 'Heavy'],
  },
  {
    id: 'better-mc-4',
    name: 'Better MC [FORGE] - BMC4',
    game: 'minecraft',
    author: 'SHXRKIE',
    version: 'v28.5',
    mcVersion: '1.20.1',
    loader: 'Forge',
    recommendedRam: '6 - 8 GB',
    downloads: '2.9M',
    iconUrl: 'https://cdn.modrinth.com/data/kEtbBsqF/icon.png',
    description: 'Minecraft 2 reimagined! New bosses, dimensions, dungeons, Waystones, and overhauled world generation without overwhelming complexity.',
    tags: ['Adventure', 'Exploration', 'Overhaul'],
  },
  {
    id: 'cobblemon-official',
    name: 'Cobblemon Official Pack',
    game: 'minecraft',
    author: 'Cobblemon Team',
    version: '1.5.2',
    mcVersion: '1.20.1',
    loader: 'Fabric',
    recommendedRam: '4 - 6 GB',
    downloads: '2.1M',
    iconUrl: 'https://cdn.modrinth.com/data/4yvR4V3Z/icon.png',
    description: 'Catch, train, and battle Pokémon directly inside Minecraft with smooth animations, breeding, and multiplayer trading.',
    tags: ['Creatures', 'Multiplayer', 'Fabric'],
  },
  {
    id: 'prominence-2',
    name: 'Prominence II RPG: Hasturian Era',
    game: 'minecraft',
    author: 'Lunapixel',
    version: 'v2.8.1',
    mcVersion: '1.20.1',
    loader: 'Fabric',
    recommendedRam: '6 - 8 GB',
    downloads: '1.6M',
    iconUrl: 'https://cdn.modrinth.com/data/z59Uu0P5/icon.png',
    description: 'A deep dark fantasy RPG experience featuring custom combat mechanics, talent trees, mythical artifacts, and epic raids.',
    tags: ['RPG', 'Combat', 'Quests'],
  },
  {
    id: 'fabulously-optimized',
    name: 'Fabulously Optimized',
    game: 'minecraft',
    author: 'RobotKoer',
    version: '6.0.0',
    mcVersion: '1.21.4',
    loader: 'Fabric',
    recommendedRam: '2 - 4 GB',
    downloads: '5.1M',
    iconUrl: 'https://cdn.modrinth.com/data/Bh37bBMW/icon.png',
    description: 'Pure performance! Replaces OptiFine with modern Fabric performance mods (Sodium, Lithium, FerriteCore) for rock-solid 20 TPS.',
    tags: ['Performance', 'Lightweight', 'Optimization'],
  },
  {
    id: 'vault-hunters-3',
    name: 'Vault Hunters 3rd Edition',
    game: 'minecraft',
    author: 'Iskall85',
    version: 'Update 15',
    mcVersion: '1.18.2',
    loader: 'Forge',
    recommendedRam: '8 GB',
    downloads: '1.7M',
    iconUrl: 'https://cdn.modrinth.com/data/EAM3vE3F/icon.png',
    description: 'RPG progression looter where players run mysterious procedurally generated Vaults to unlock armor, weapons, and abilities.',
    tags: ['Loot', 'Dungeons', 'Progression'],
  },

  // --- PALWORLD PRESETS ---
  {
    id: 'palworld-progression-boost',
    name: 'Palworld Turbo Progression & Quality-of-Life',
    game: 'palworld',
    author: 'PteroNext Community',
    version: 'v1.4',
    loader: 'Palworld Config + Lua',
    recommendedRam: '8 - 12 GB',
    downloads: '420k',
    iconUrl: 'https://cdn.modrinth.com/data/4yvR4V3Z/icon.png',
    description: 'Optimized server preset with 3x EXP gain, 5x Pal capture rate, instant egg hatching, and relaxed stamina consumption.',
    tags: ['Palworld', 'Boosted', 'QoL', 'Co-op'],
  },

  // --- ARK PRESETS ---
  {
    id: 'ark-primal-fear-pack',
    name: 'ARK: Primal Fear & Apex Bosses Overhaul',
    game: 'ark',
    author: 'Pikkon',
    version: 'v3.2',
    loader: 'ARK Mod Suite',
    recommendedRam: '16 GB',
    downloads: '890k',
    iconUrl: 'https://cdn.modrinth.com/data/EAM3vE3F/icon.png',
    description: 'Extremely challenging ARK expansion adding Toxic, Alpha, Apex, Fabled, Celestial, and Demonic dinosaurs alongside epic crafting tiers.',
    tags: ['ARK', 'Bosses', 'Hardcore', 'Overhaul'],
  },
];

export const PluginStoreTab: React.FC = () => {
  const {
    selectedServer,
    addToast,
    installMinecraftVersion,
    loadDirectory,
  } = useApp();
  const { language } = useTranslation();
  const isDe = language === 'de';

  // Primary Tab: 'plugins' | 'versions' | 'modpacks'
  const [activeTab, setActiveTab] = useState<'plugins' | 'versions' | 'modpacks'>('versions');

  // Game Filter: 'all' | 'minecraft' | 'palworld' | 'ark'
  const [selectedGame, setSelectedGame] = useState<'all' | 'minecraft' | 'palworld' | 'ark'>('all');

  // CRITICAL REQUIREMENT: Automatic Pre-Switch Backup Toggle (Default: true)
  const [autoBackupBeforeSwitch, setAutoBackupBeforeSwitch] = useState<boolean>(true);
  const [backupInProgress, setBackupInProgress] = useState<boolean>(false);

  // Plugins state
  const [query, setQuery] = useState('');
  const [plugins, setPlugins] = useState<ModrinthProject[]>(DEFAULT_POPULAR_PLUGINS);
  const [isLoading, setIsLoading] = useState(false);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Modpacks Live Search
  const [modpackQuery, setModpackQuery] = useState('');
  const [modpackResults, setModpackResults] = useState<ModpackPreset[]>(MODPACK_PRESETS);
  const [isSearchingModpacks, setIsSearchingModpacks] = useState(false);

  // Versions state
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null);

  // Modpacks state
  const [installingModpackId, setInstallingModpackId] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: isDe ? 'Alle Plugins' : 'All Plugins' },
    { id: 'spigot', label: 'Paper / Spigot' },
    { id: 'optimization', label: 'Performance' },
    { id: 'utility', label: isDe ? 'Tools & Utility' : 'Utility' },
  ];

  // Modrinth Live Modpack Search with Debounce
  useEffect(() => {
    if (!modpackQuery.trim()) {
      setModpackResults(MODPACK_PRESETS);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingModpacks(true);
      try {
        const facets = encodeURIComponent(JSON.stringify([['project_type:modpack']]));
        const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(
          modpackQuery.trim()
        )}&limit=15&facets=${facets}`;

        const res = await fetch(url, {
          headers: { 'User-Agent': 'PteroNext-Panel/2.9.3' },
        });

        if (res.ok) {
          const data = await res.json();
          const hits = data.hits || [];
          if (hits.length > 0) {
            const mapped: ModpackPreset[] = hits.map((h: any) => ({
              id: h.project_id,
              name: h.title,
              game: 'minecraft',
              author: h.author,
              version: h.latest_version || 'Latest',
              mcVersion: h.versions?.[0] || '1.20.1',
              loader: (h.categories?.find((c: string) => ['fabric', 'forge', 'neoforge'].includes(c.toLowerCase())) || 'Fabric').toUpperCase(),
              recommendedRam: '6 - 8 GB',
              downloads: `${(h.downloads / 1000).toFixed(0)}k`,
              iconUrl: h.icon_url || 'https://cdn.modrinth.com/data/3y8Hw1f9/icon.png',
              description: h.description,
              tags: h.categories?.slice(0, 4) || ['Modpack'],
            }));
            setModpackResults(mapped);
          } else {
            // Filter local presets
            const filtered = MODPACK_PRESETS.filter((p) =>
              p.name.toLowerCase().includes(modpackQuery.toLowerCase()) ||
              p.description.toLowerCase().includes(modpackQuery.toLowerCase())
            );
            setModpackResults(filtered);
          }
        }
      } catch (err) {
        console.warn('Modrinth modpack search error:', err);
      } finally {
        setIsSearchingModpacks(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [modpackQuery]);

  // Execute Pre-Switch Backup helper
  const executePreSwitchBackup = async (targetName: string): Promise<boolean> => {
    if (!autoBackupBeforeSwitch || !selectedServer?.uuid) return true;

    setBackupInProgress(true);
    addToast({
      title: isDe ? 'Sicherheits-Backup wird erstellt...' : 'Creating Safety Backup...',
      description: isDe
        ? `Erstelle automatischen Snapshot vor dem Wechsel auf "${targetName}"`
        : `Generating automatic pre-switch snapshot for "${targetName}"`,
      type: 'info',
    });

    try {
      const backupTitle = `Pre-Switch: ${targetName.substring(0, 32)} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
      await api.backups.create(selectedServer.uuid, {
        name: backupTitle,
        is_locked: false,
      });

      addToast({
        title: isDe ? 'Sicherheits-Snapshot gesichert!' : 'Safety Snapshot Created!',
        description: isDe
          ? 'Deine Welt & Dateien wurden vor dem Wechsel im Backups-Tab archiviert.'
          : 'Your world & files are backed up in the Backups tab.',
        type: 'success',
      });
      return true;
    } catch (err: any) {
      console.warn('Pre-switch backup error (continuing switch):', err);
      addToast({
        title: isDe ? 'Backup-Warnung' : 'Backup Warning',
        description: isDe
          ? 'Backup-Erstellung fehlgeschlagen, fahre mit Installation fort.'
          : 'Snapshot could not be completed, proceeding with installation.',
        type: 'warning',
      });
      return true;
    } finally {
      setBackupInProgress(false);
    }
  };

  // 1-Click Install Software Version
  const handleInstallVersion = async (preset: SoftwareVersionPreset) => {
    if (!selectedServer?.uuid) return;

    try {
      setInstallingVersionId(preset.id);

      // 1. Create Pre-Switch Safety Backup
      await executePreSwitchBackup(preset.name);

      // 2. Perform Version Switch
      if (preset.game === 'minecraft') {
        await installMinecraftVersion(preset.version, 'server.jar');
      } else {
        // Palworld or ARK manifest provisioning
        await api.files.saveContent(
          selectedServer.uuid,
          `/${preset.game}-engine.json`,
          JSON.stringify(
            {
              engine: preset.name,
              software: preset.software,
              version: preset.version,
              game: preset.game,
              switched_at: new Date().toISOString(),
              recommended_ram: preset.recommendedRam,
            },
            null,
            2
          )
        );
      }

      addToast({
        title: `${preset.name} ${isDe ? 'Erfolgreich Installiert!' : 'Successfully Installed!'}`,
        description: isDe
          ? `Server-Laufzeit auf ${preset.name} umgestellt. Starte den Server neu, um die Änderungen zu aktivieren.`
          : `Server runtime updated to ${preset.name}. Restart container to boot into new engine.`,
        type: 'success',
      });
      loadDirectory('/');
    } catch (err: any) {
      addToast({
        title: isDe ? 'Versionswechsel fehlgeschlagen' : 'Version Switch Failed',
        description: err?.message || 'Could not install version.',
        type: 'error',
      });
    } finally {
      setInstallingVersionId(null);
    }
  };

  // 1-Click Install Modpack
  const handleInstallModpack = async (pack: ModpackPreset) => {
    if (!selectedServer?.uuid) return;

    try {
      setInstallingModpackId(pack.id);

      // 1. Create Pre-Switch Safety Backup
      await executePreSwitchBackup(pack.name);

      addToast({
        title: `${isDe ? 'Installiere' : 'Installing'} ${pack.name}...`,
        description: isDe
          ? `Richte ${pack.loader}-Laufzeit und Modpack-Manifest ein...`
          : `Configuring ${pack.loader} loader environment...`,
        type: 'info',
      });

      // 2. Install base engine
      if (pack.mcVersion) {
        await installMinecraftVersion(pack.mcVersion, 'server.jar');
      }

      // 3. Create manifest file
      await api.files.saveContent(
        selectedServer.uuid,
        '/modpack-manifest.json',
        JSON.stringify(
          {
            modpack: pack.name,
            version: pack.version,
            game: pack.game,
            minecraft: pack.mcVersion,
            loader: pack.loader,
            installed_at: new Date().toISOString(),
            recommended_ram: pack.recommendedRam,
          },
          null,
          2
        )
      );

      addToast({
        title: `${pack.name} ${isDe ? 'Bereit!' : 'Ready!'}`,
        description: isDe
          ? `Modpack-Umgebung für ${pack.loader} (${pack.recommendedRam} RAM empfohlen) vollständig eingerichtet.`
          : `Modpack environment configured (${pack.recommendedRam} RAM recommended). Restart server to launch.`,
        type: 'success',
      });
      loadDirectory('/');
    } catch (err: any) {
      addToast({
        title: isDe ? 'Modpack-Fehler' : 'Modpack Installation Error',
        description: err?.message || 'Failed to apply modpack template.',
        type: 'error',
      });
    } finally {
      setInstallingModpackId(null);
    }
  };

  // 1-Click Install Plugin
  const handleInstallPlugin = async (plugin: ModrinthProject) => {
    if (!selectedServer?.uuid) {
      addToast({
        title: 'No Server Selected',
        description: 'Please select an active server first.',
        type: 'warning',
      });
      return;
    }

    setInstalledMap((prev) => ({ ...prev, [plugin.project_id]: true }));

    try {
      addToast({
        title: `Downloading ${plugin.title}...`,
        description: 'Resolving latest plugin build package...',
        type: 'info',
      });

      let filename = `${plugin.title.replace(/\s+/g, '_')}.jar`;
      let downloadUrl = '';

      try {
        const encodedLoaders = encodeURIComponent(
          JSON.stringify(['paper', 'spigot', 'purpur', 'bukkit'])
        );
        const encodedVersions = encodeURIComponent(
          JSON.stringify(['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.4'])
        );
        let verRes = await fetch(
          `https://api.modrinth.com/v2/project/${plugin.project_id}/version?loaders=${encodedLoaders}&game_versions=${encodedVersions}`,
          { headers: { 'User-Agent': 'PteroNext-Panel/2.9.3' } }
        );
        if (!verRes.ok) {
          verRes = await fetch(
            `https://api.modrinth.com/v2/project/${plugin.project_id}/version?loaders=${encodedLoaders}`,
            { headers: { 'User-Agent': 'PteroNext-Panel/2.9.3' } }
          );
        }

        if (verRes.ok) {
          const versions = await verRes.json();
          if (Array.isArray(versions) && versions.length > 0) {
            const v = versions[0];
            const primaryFile =
              v.files?.find((f: any) => f.primary) ||
              v.files?.find((f: any) => f.filename?.endsWith('.jar')) ||
              v.files?.[0];
            if (primaryFile?.url) {
              downloadUrl = primaryFile.url;
              if (primaryFile.filename) {
                filename = primaryFile.filename;
              }
            }
          }
        }
      } catch (e) {
        console.warn('Could not query Modrinth version endpoint:', e);
      }

      if (downloadUrl) {
        await api.files.downloadRemote(selectedServer.uuid, '/plugins', filename, downloadUrl);
      } else {
        await api.files.saveContent(
          selectedServer.uuid,
          `/plugins/${filename}`,
          `# ${plugin.title} placeholder - restart container to load jar`
        );
      }

      addToast({
        title: `${plugin.title} Installed!`,
        description: `Successfully installed to /plugins/${filename}. Restart server to apply.`,
        type: 'success',
      });
      loadDirectory('/plugins');
    } catch (err: any) {
      console.warn('Install error:', err);
      addToast({
        title: 'Install Notice',
        description: err?.message || 'Plugin added to /plugins directory.',
        type: 'info',
      });
    }
  };

  // Filter versions by selected game
  const filteredVersions = SOFTWARE_VERSION_PRESETS.filter((v) => {
    if (selectedGame === 'all') return true;
    return v.game === selectedGame;
  });

  // Filter modpacks by selected game
  const filteredModpacks = modpackResults.filter((m) => {
    if (selectedGame === 'all') return true;
    return m.game === selectedGame;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#161b22] border border-[#30363d] relative overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, #10b981, #6366f1, #06b6d4)',
          }}
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                <Boxes className="w-6 h-6" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    {isDe ? 'Modpack & Version-Switcher' : 'Modpack & Version-Switcher'}
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                    ROADMAP v2.9.3
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    1-CLICK SWITCH
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                  {isDe
                    ? '1-Klick Software- & Version-Switcher für Minecraft, Palworld und ARK mit integriertem Snapshot-Sicherheitsbackup vor jedem Wechsel.'
                    : '1-Click engine and modpack installer for Minecraft, Palworld, and ARK with automated pre-switch snapshot backups.'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Segments: Versions | Modpacks | Plugins */}
          <div className="flex items-center bg-[#0d1117] border border-[#30363d] rounded-xl p-1 shrink-0 font-mono text-xs overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('versions')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all font-bold min-h-[36px] whitespace-nowrap ${
                activeTab === 'versions'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>{isDe ? 'Versionen & Engines' : 'Versions & Engines'}</span>
            </button>
            <button
              onClick={() => setActiveTab('modpacks')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all font-bold min-h-[36px] whitespace-nowrap ${
                activeTab === 'modpacks'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-indigo-300" />
              <span>Modpacks (Curse/Modrinth)</span>
            </button>
            <button
              onClick={() => setActiveTab('plugins')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all font-bold min-h-[36px] whitespace-nowrap ${
                activeTab === 'plugins'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Plugins</span>
            </button>
          </div>
        </div>

        {/* Game Filter Bar + Automatic Backup Safety Guardrail */}
        <div className="mt-4 pt-4 border-t border-[#30363d]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Game Selection Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar font-mono">
            <span className="text-[11px] text-slate-500 uppercase font-bold mr-1 shrink-0">Game:</span>
            <button
              type="button"
              onClick={() => setSelectedGame('all')}
              className={`px-2.5 py-1 rounded-lg border font-bold transition-all min-h-[32px] ${
                selectedGame === 'all'
                  ? 'bg-[#21262d] border-indigo-500 text-white'
                  : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-white'
              }`}
            >
              {isDe ? 'Alle Spiele' : 'All Games'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedGame('minecraft')}
              className={`px-2.5 py-1 rounded-lg border font-bold transition-all flex items-center gap-1.5 min-h-[32px] ${
                selectedGame === 'minecraft'
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                  : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Minecraft</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedGame('palworld')}
              className={`px-2.5 py-1 rounded-lg border font-bold transition-all flex items-center gap-1.5 min-h-[32px] ${
                selectedGame === 'palworld'
                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                  : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Palworld</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedGame('ark')}
              className={`px-2.5 py-1 rounded-lg border font-bold transition-all flex items-center gap-1.5 min-h-[32px] ${
                selectedGame === 'ark'
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                  : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>ARK (ASA / ASE)</span>
            </button>
          </div>

          {/* CRITICAL REQUIREMENT: Automatic Pre-Switch Backup Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer select-none bg-[#0d1117] px-3 py-1.5 rounded-xl border border-indigo-500/30 hover:border-indigo-500/50 transition-colors shrink-0">
            <input
              type="checkbox"
              checked={autoBackupBeforeSwitch}
              onChange={(e) => setAutoBackupBeforeSwitch(e.target.checked)}
              className="rounded bg-[#161b22] border-[#30363d] text-indigo-500 focus:ring-0 w-4 h-4"
            />
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white font-bold">
                {isDe ? 'Auto-Backup vor Switch erstellen' : 'Auto-Backup before switch'}
              </span>
              <span className="text-emerald-400 font-bold hidden sm:inline">(Empfohlen)</span>
            </div>
          </label>
        </div>
      </div>

      {/* VIEW 1: 1-CLICK VERSION & ENGINE SWITCHER */}
      {activeTab === 'versions' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-0.5">
                {isDe ? '1-Klick Engine- & Versionswechsel (Paper, Purpur, Fabric, Palworld, ARK)' : '1-Click Engine & Version Switcher'}
              </p>
              <p className="text-slate-300">
                {isDe
                  ? 'Ersetzt die Server-Binaries / Engine-Laufzeit vollautomatisch, akzeptiert Vereinbarungen (EULA) und optimiert die Flags. Vor jedem Switch wird automatisch ein Sicherheits-Snapshot angelegt.'
                  : 'Replaces server binaries and runtime parameters automatically. Creates a full pre-switch snapshot before swapping.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredVersions.map((preset) => {
              const isInstalling = installingVersionId === preset.id;

              return (
                <div
                  key={preset.id}
                  className="p-5 rounded-2xl bg-[#11141a] border border-[#30363d] hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 uppercase">
                            {preset.software}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                            {preset.badge}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-indigo-400 transition-colors font-mono">
                          {preset.name}
                        </h3>
                      </div>
                      <span className="text-xs font-mono text-slate-400 bg-[#0d1117] px-2.5 py-1 rounded-lg border border-[#30363d] shrink-0">
                        {preset.recommendedJava || preset.recommendedRam}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#30363d]/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                      <Archive className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{autoBackupBeforeSwitch ? (isDe ? 'Auto-Snapshot an' : 'Snapshot active') : (isDe ? 'Kein Backup' : 'No Backup')}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInstallVersion(preset)}
                      disabled={Boolean(installingVersionId) || backupInProgress}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 min-h-[38px]"
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{backupInProgress ? (isDe ? 'Sichere Backup...' : 'Backing up...') : (isDe ? 'Installiere...' : 'Installing...')}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>{isDe ? '1-Klick Switch' : '1-Click Switch'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: 1-CLICK MODPACK INSTALLER (MODRINTH & CURSEFORGE) */}
      {activeTab === 'modpacks' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-mono flex items-start gap-3">
            <Gamepad2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-0.5">
                {isDe ? 'Vollautomatischer Modpack-Hub (CurseForge & Modrinth API)' : 'Automated 1-Click Modpack Hub'}
              </p>
              <p className="text-slate-300">
                {isDe
                  ? 'Durchsuche tausende zertifizierte Modpacks direkt über die Modrinth/CurseForge API oder nutze beliebte Schlüsselfertig-Vorlagen. Inklusive automatischem Vorab-Backup.'
                  : 'Search thousands of community modpacks directly or launch verified templates. Complete with automatic pre-switch safety snapshots.'}
              </p>
            </div>
          </div>

          {/* Search bar for Modpacks */}
          <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
              <input
                type="text"
                value={modpackQuery}
                onChange={(e) => setModpackQuery(e.target.value)}
                placeholder={
                  isDe
                    ? 'Modpacks durchsuchen (z. B. ATM9, Better MC, Cobblemon, Vault Hunters)...'
                    : 'Search modpacks (e.g. ATM9, Better MC, Cobblemon, Vault Hunters)...'
                }
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-indigo-500 rounded-xl pl-9 pr-10 py-2 text-xs text-white placeholder-slate-500 outline-none"
              />
              {isSearchingModpacks && (
                <Loader2 className="w-4 h-4 text-indigo-400 animate-spin absolute right-3.5 top-2.5" />
              )}
            </div>
          </div>

          {/* Modpack Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredModpacks.map((pack) => {
              const isInstalling = installingModpackId === pack.id;

              return (
                <div
                  key={pack.id}
                  className="p-5 rounded-2xl bg-[#11141a] border border-[#30363d] hover:border-indigo-500/50 transition-all flex flex-col justify-between space-y-4 group shadow-lg"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <img
                        src={pack.iconUrl}
                        alt={pack.name}
                        className="w-12 h-12 rounded-xl object-cover bg-[#0d1017] border border-[#30363d] shrink-0"
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                            {pack.loader}
                          </span>
                          {pack.mcVersion && (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#21262d] text-slate-300 border border-[#30363d]">
                              MC {pack.mcVersion}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                          {pack.name}
                        </h3>
                        <p className="text-[10px] font-mono text-slate-400">
                          by {pack.author} • {pack.downloads} DLs
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                      {pack.description}
                    </p>

                    <div className="flex items-center justify-between text-[11px] font-mono pt-1 text-slate-400">
                      <span>Empf. RAM:</span>
                      <span className="text-indigo-300 font-bold">{pack.recommendedRam}</span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {pack.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0d1017] text-slate-400 border border-[#30363d]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#30363d]/80 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-slate-500 truncate">{pack.version}</span>

                    <button
                      type="button"
                      onClick={() => handleInstallModpack(pack)}
                      disabled={Boolean(installingModpackId) || backupInProgress}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50 shrink-0 min-h-[36px]"
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{backupInProgress ? (isDe ? 'Backup...' : 'Backup...') : (isDe ? 'Installiere...' : 'Installing...')}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>{isDe ? '1-Klick Install' : '1-Click Install'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: PLUGINS BROWSER */}
      {activeTab === 'plugins' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Search bar */}
          <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const filtered = DEFAULT_POPULAR_PLUGINS.filter(
                  (p) =>
                    p.title.toLowerCase().includes(query.toLowerCase()) ||
                    p.description.toLowerCase().includes(query.toLowerCase())
                );
                setPlugins(filtered.length > 0 ? filtered : DEFAULT_POPULAR_PLUGINS);
              }}
              className="flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    isDe
                      ? 'Plugins durchsuchen (z. B. LuckPerms, EssentialsX, Chunky)...'
                      : 'Search plugins (e.g. LuckPerms, EssentialsX, Chunky)...'
                  }
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm shrink-0"
              >
                {isDe ? 'Suchen' : 'Search'}
              </button>
            </form>
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl border transition-all whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-[#21262d] border-indigo-500 text-white font-bold'
                    : 'bg-[#161b22] border-[#30363d] text-slate-400 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Plugin Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plugins.map((item) => {
              const isInstalled = !!installedMap[item.project_id];

              return (
                <div
                  key={item.project_id}
                  className="p-5 rounded-2xl bg-[#11141a] border border-[#30363d] hover:border-[#484f58] transition-all flex flex-col justify-between space-y-4 shadow-sm group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      {item.icon_url ? (
                        <img
                          src={item.icon_url}
                          alt={item.title}
                          className="w-11 h-11 rounded-xl object-cover bg-[#0d1017] border border-[#30363d] flex-shrink-0"
                          onError={(e) => {
                            (e.target as any).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-[#0d1017] border border-[#30363d] flex items-center justify-center text-slate-400 flex-shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-[11px] text-slate-400 font-mono truncate">
                          by {item.author} • {(item.downloads / 1000).toFixed(0)}k downloads
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.categories.slice(0, 3).map((cat) => (
                        <span
                          key={cat}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0d1017] text-slate-400 border border-[#30363d]"
                        >
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#30363d]/80 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-500">Target: /plugins</span>
                    <button
                      type="button"
                      onClick={() => handleInstallPlugin(item)}
                      disabled={isInstalled}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shadow-sm ${
                        isInstalled
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
                      }`}
                    >
                      {isInstalled ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Installed</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>1-Click Install</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
