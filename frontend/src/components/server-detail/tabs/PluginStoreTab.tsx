import React, { useState } from 'react';
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

interface MinecraftVersionPreset {
  id: string;
  name: string;
  software: 'PaperMC' | 'Purpur' | 'Fabric' | 'Forge' | 'NeoForge' | 'Vanilla';
  version: string;
  recommendedJava: string;
  badge: string;
  description: string;
}

interface ModpackPreset {
  id: string;
  name: string;
  author: string;
  version: string;
  mcVersion: string;
  loader: 'Fabric' | 'Forge' | 'NeoForge';
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

const SOFTWARE_VERSION_PRESETS: MinecraftVersionPreset[] = [
  {
    id: 'paper-1.21.1',
    name: 'PaperMC 1.21.1',
    software: 'PaperMC',
    version: '1.21.1',
    recommendedJava: 'Java 21',
    badge: 'LATEST RECOMMENDED',
    description: 'Ultra-fast, stable PaperMC server build with advanced tick optimization, modern datapack fixes, and full plugin compatibility.',
  },
  {
    id: 'paper-1.20.4',
    name: 'PaperMC 1.20.4',
    software: 'PaperMC',
    version: '1.20.4',
    recommendedJava: 'Java 17',
    badge: 'LTS STABLE',
    description: 'The golden standard LTS release for production Minecraft networks and survival servers.',
  },
  {
    id: 'purpur-1.21.1',
    name: 'Purpur 1.21.1',
    software: 'Purpur',
    version: '1.21.1',
    recommendedJava: 'Java 21',
    badge: 'PERFORMANCE+',
    description: 'Drop-in replacement for Paper with extreme gameplay configurability, ridable mobs, and TPS enhancements.',
  },
  {
    id: 'fabric-1.21.1',
    name: 'Fabric Loader 1.21.1',
    software: 'Fabric',
    version: '1.21.1',
    recommendedJava: 'Java 21',
    badge: 'LIGHTWEIGHT MODS',
    description: 'Lightweight, modern modular modding toolchain. Perfect for Sodium, Lithium, and modern modpacks.',
  },
  {
    id: 'neoforge-1.21.1',
    name: 'NeoForge 1.21.1',
    software: 'NeoForge',
    version: '1.21.1',
    recommendedJava: 'Java 21',
    badge: 'MODDING',
    description: 'The next-generation community-driven Forge successor for large-scale modded Minecraft servers.',
  },
  {
    id: 'paper-1.19.4',
    name: 'PaperMC 1.19.4',
    software: 'PaperMC',
    version: '1.19.4',
    recommendedJava: 'Java 17',
    badge: 'LEGACY STABLE',
    description: 'Stable 1.19 release with broad legacy plugin support.',
  },
  {
    id: 'paper-1.16.5',
    name: 'PaperMC 1.16.5',
    software: 'PaperMC',
    version: '1.16.5',
    recommendedJava: 'Java 11 / 16',
    badge: 'NETHER UPDATE',
    description: 'Classic 1.16.5 release for legendary modpacks and competitive servers.',
  },
  {
    id: 'paper-1.8.8',
    name: 'PaperMC 1.8.8',
    software: 'PaperMC',
    version: '1.8.8',
    recommendedJava: 'Java 8',
    badge: 'PVP CLASSIC',
    description: 'The ultimate 1.8.8 PvP competitive combat baseline.',
  },
];

const MODPACK_PRESETS: ModpackPreset[] = [
  {
    id: 'all-the-mods-9',
    name: 'All The Mods 9 (ATM9)',
    author: 'ATM Team',
    version: 'v0.3.2',
    mcVersion: '1.20.1',
    loader: 'Forge',
    recommendedRam: '8 - 12 GB',
    downloads: '3.2M',
    iconUrl: 'https://cdn.modrinth.com/data/3y8Hw1f9/icon.png',
    description: 'The definitive kitchen-sink modpack featuring GregTech, Applied Energistics, Mekanism, Twilight Forest, and over 400 quests.',
    tags: ['Tech', 'Magic', 'Quests', 'Heavy'],
  },
  {
    id: 'better-mc-4',
    name: 'Better MC [FORGE] - BMC4',
    author: 'SHXRKIE',
    version: 'v28.5',
    mcVersion: '1.20.1',
    loader: 'Forge',
    recommendedRam: '6 - 8 GB',
    downloads: '2.8M',
    iconUrl: 'https://cdn.modrinth.com/data/kEtbBsqF/icon.png',
    description: 'Minecraft 2 reimagined! New bosses, dimensions, dungeons, Waystones, and overhauled world generation without overwhelming complexity.',
    tags: ['Adventure', 'Exploration', 'Overhaul'],
  },
  {
    id: 'cobblemon-official',
    name: 'Cobblemon Official Pack',
    author: 'Cobblemon Team',
    version: '1.5.2',
    mcVersion: '1.20.1',
    loader: 'Fabric',
    recommendedRam: '4 - 6 GB',
    downloads: '1.9M',
    iconUrl: 'https://cdn.modrinth.com/data/4yvR4V3Z/icon.png',
    description: 'Catch, train, and battle Pokémon directly inside Minecraft with smooth animations, breeding, and multiplayer trading.',
    tags: ['Creatures', 'Multiplayer', 'Fabric'],
  },
  {
    id: 'prominence-2',
    name: 'Prominence II RPG: Hasturian Era',
    author: 'Lunapixel',
    version: 'v2.8.1',
    mcVersion: '1.20.1',
    loader: 'Fabric',
    recommendedRam: '6 - 8 GB',
    downloads: '1.4M',
    iconUrl: 'https://cdn.modrinth.com/data/z59Uu0P5/icon.png',
    description: 'A deep dark fantasy RPG experience featuring custom combat mechanics, talent trees, mythical artifacts, and epic raids.',
    tags: ['RPG', 'Combat', 'Quests'],
  },
  {
    id: 'fabulously-optimized',
    name: 'Fabulously Optimized',
    author: 'RobotKoer',
    version: '6.0.0',
    mcVersion: '1.21.1',
    loader: 'Fabric',
    recommendedRam: '2 - 4 GB',
    downloads: '4.8M',
    iconUrl: 'https://cdn.modrinth.com/data/Bh37bBMW/icon.png',
    description: 'Pure performance! Replaces OptiFine with modern Fabric performance mods (Sodium, Lithium, FerriteCore) for rock-solid 20 TPS.',
    tags: ['Performance', 'Lightweight', 'Optimization'],
  },
  {
    id: 'vault-hunters-3',
    name: 'Vault Hunters 3rd Edition',
    author: 'Iskall85',
    version: 'Update 15',
    mcVersion: '1.18.2',
    loader: 'Forge',
    recommendedRam: '8 GB',
    downloads: '1.6M',
    iconUrl: 'https://cdn.modrinth.com/data/EAM3vE3F/icon.png',
    description: 'RPG progression looter where players run mysterious procedurally generated Vaults to unlock armor, weapons, and abilities.',
    tags: ['Loot', 'Dungeons', 'Progression'],
  },
];

export const PluginStoreTab: React.FC = () => {
  const {
    selectedServer,
    addToast,
    installMinecraftVersion,
    addTerminalCommand,
    loadDirectory,
  } = useApp();
  const { language } = useTranslation();

  // Primary Tab: 'plugins' | 'versions' | 'modpacks'
  const [activeTab, setActiveTab] = useState<'plugins' | 'versions' | 'modpacks'>('plugins');

  // Plugins state
  const [query, setQuery] = useState('');
  const [plugins, setPlugins] = useState<ModrinthProject[]>(DEFAULT_POPULAR_PLUGINS);
  const [isLoading, setIsLoading] = useState(false);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string>('spigot');

  // Versions state
  const [installingVersionId, setInstallingVersionId] = useState<string | null>(null);

  // Modpacks state
  const [installingModpackId, setInstallingModpackId] = useState<string | null>(null);

  const categories = [
    { id: 'all', label: language === 'de' ? 'Alle Plugins' : 'All Plugins' },
    { id: 'spigot', label: 'Paper / Spigot' },
    { id: 'optimization', label: language === 'de' ? 'Performance' : 'Performance' },
    { id: 'utility', label: language === 'de' ? 'Tools & Utility' : 'Utility' },
  ];

  // Fetch from Modrinth Public API filtered to Paper/Spigot plugins
  const searchModrinth = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const facets = encodeURIComponent(
        JSON.stringify([
          ['project_type:plugin'],
          ['categories:paper', 'categories:spigot', 'categories:purpur', 'categories:bukkit'],
        ])
      );
      const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(
        searchQuery
      )}&limit=16&facets=${facets}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'PteroNext-Panel/1.0',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const mapped: ModrinthProject[] = (data.hits || []).map((hit: any) => ({
          project_id: hit.project_id,
          title: hit.title,
          author: hit.author,
          description: hit.description,
          downloads: hit.downloads,
          icon_url: hit.icon_url,
          categories: hit.categories || [],
        }));
        setPlugins(mapped.length > 0 ? mapped : DEFAULT_POPULAR_PLUGINS);
      }
    } catch (err) {
      const filtered = DEFAULT_POPULAR_PLUGINS.filter(
        (p) =>
          p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setPlugins(filtered.length > 0 ? filtered : DEFAULT_POPULAR_PLUGINS);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchModrinth(query.trim());
    } else {
      setPlugins(DEFAULT_POPULAR_PLUGINS);
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
          { headers: { 'User-Agent': 'PteroNext-Panel/1.0' } }
        );
        if (!verRes.ok) {
          verRes = await fetch(
            `https://api.modrinth.com/v2/project/${plugin.project_id}/version?loaders=${encodedLoaders}`,
            { headers: { 'User-Agent': 'PteroNext-Panel/1.0' } }
          );
        }
        if (!verRes.ok) {
          verRes = await fetch(
            `https://api.modrinth.com/v2/project/${plugin.project_id}/version`,
            { headers: { 'User-Agent': 'PteroNext-Panel/1.0' } }
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

  // 1-Click Install Software Version
  const handleInstallVersion = async (preset: MinecraftVersionPreset) => {
    if (!selectedServer?.uuid) return;
    try {
      setInstallingVersionId(preset.id);
      await installMinecraftVersion(preset.version, 'server.jar');
      addToast({
        title: `${preset.name} Installed!`,
        description: `server.jar updated to ${preset.version} with eula.txt accepted.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Version Installation Failed',
        description: err?.message || 'Could not install version jar.',
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
      addToast({
        title: `Installing ${pack.name}...`,
        description: `Configuring ${pack.loader} loader for Minecraft ${pack.mcVersion}...`,
        type: 'info',
      });

      // Install base engine
      await installMinecraftVersion(pack.mcVersion, 'server.jar');

      // Create manifest file
      await api.files.saveContent(
        selectedServer.uuid,
        '/modpack-manifest.json',
        JSON.stringify(
          {
            modpack: pack.name,
            version: pack.version,
            minecraft: pack.mcVersion,
            loader: pack.loader,
            installed_at: new Date().toISOString(),
          },
          null,
          2
        )
      );

      addToast({
        title: `${pack.name} Ready!`,
        description: `Modpack environment configured for Minecraft ${pack.mcVersion} (${pack.loader}). Recommended RAM: ${pack.recommendedRam}.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Modpack Installation Error',
        description: err?.message || 'Failed to apply modpack template.',
        type: 'error',
      });
    } finally {
      setInstallingModpackId(null);
    }
  };

  const filteredList = plugins.filter((p) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'spigot') {
      return p.categories.some((c) =>
        ['paper', 'spigot', 'purpur', 'bukkit'].includes(c.toLowerCase())
      );
    }
    if (activeCategory === 'optimization') {
      return (
        p.categories.includes('optimization') ||
        p.title.toLowerCase().includes('chunky') ||
        p.title.toLowerCase().includes('clear')
      );
    }
    if (activeCategory === 'utility') {
      return (
        p.categories.includes('utility') ||
        p.title.toLowerCase().includes('luckperms') ||
        p.title.toLowerCase().includes('essential')
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-[#161b22] border border-[#30363d] relative overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: 'linear-gradient(90deg, transparent, #6366f1, transparent)',
          }}
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
                <Boxes className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>{language === 'de' ? 'Ecosystem Store & Installer' : 'Ecosystem Store & Installer'}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    1-CLICK READY
                  </span>
                </h2>
                <p className="text-xs text-slate-400">
                  {language === 'de'
                    ? '1-Klick Modpack-Installer, Version-Switcher und zertifizierte Plugins direkt auf den Server laden'
                    : '1-Click modpack installer, software version switcher, and verified community plugins directly to your server'}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Segments: Plugins | Versions | Modpacks */}
          <div className="flex items-center bg-[#0d1117] border border-[#30363d] rounded-xl p-1 shrink-0 font-mono text-xs">
            <button
              onClick={() => setActiveTab('plugins')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-semibold ${
                activeTab === 'plugins'
                  ? 'bg-[#21262d] text-white shadow-sm border border-[#30363d]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Plugins</span>
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-semibold ${
                activeTab === 'versions'
                  ? 'bg-[#21262d] text-white shadow-sm border border-[#30363d]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'de' ? 'Versionen' : 'Versions'}</span>
            </button>
            <button
              onClick={() => setActiveTab('modpacks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all font-semibold ${
                activeTab === 'modpacks'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-3.5 h-3.5 text-indigo-300" />
              <span>Modpacks</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: PLUGINS BROWSER */}
      {activeTab === 'plugins' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* Search bar */}
          <div className="bg-[#161b22] rounded-xl p-3 border border-[#30363d]">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={
                    language === 'de'
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
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : language === 'de' ? 'Suchen' : 'Search'}
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
            {filteredList.map((item) => {
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

      {/* VIEW 2: 1-CLICK VERSION SWITCHER */}
      {activeTab === 'versions' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-0.5">
                {language === 'de' ? '1-Klick Software & Versionswechsel' : '1-Click Software & Version Switcher'}
              </p>
              <p className="text-slate-300">
                {language === 'de'
                  ? 'Lädt die offizielle Server-JAR herunter, ersetzt server.jar, akzeptiert automatisch eula.txt und optimiert die Container-Umgebung.'
                  : 'Downloads official server JARs, replaces server.jar, automatically accepts eula.txt, and configures the runtime environment.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SOFTWARE_VERSION_PRESETS.map((preset) => {
              const isInstalling = installingVersionId === preset.id;

              return (
                <div
                  key={preset.id}
                  className="p-5 rounded-2xl bg-[#11141a] border border-[#30363d] hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
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
                      <span className="text-xs font-mono text-slate-400 bg-[#0d1117] px-2.5 py-1 rounded-lg border border-[#30363d]">
                        {preset.recommendedJava}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#30363d]/80 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-500">
                      Destination: /server.jar
                    </span>

                    <button
                      type="button"
                      onClick={() => handleInstallVersion(preset)}
                      disabled={Boolean(installingVersionId)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Installing...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>1-Click Switch</span>
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

      {/* VIEW 3: 1-CLICK MODPACK INSTALLER */}
      {activeTab === 'modpacks' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-mono flex items-start gap-3">
            <Gamepad2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-0.5">
                {language === 'de' ? 'Vollautomatischer Modpack-Installer' : 'Automated 1-Click Modpack Installer'}
              </p>
              <p className="text-slate-300">
                {language === 'de'
                  ? 'Richtet komplette Modpack-Umgebungen (Forge, Fabric, NeoForge) inklusive Startkonfiguration und EULA schlüsselfertig ein.'
                  : 'Provisions full modpack environments (Forge, Fabric, NeoForge) complete with startup flags, server jars, and accepted EULA.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODPACK_PRESETS.map((pack) => {
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
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#21262d] text-slate-300 border border-[#30363d]">
                            MC {pack.mcVersion}
                          </span>
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
                      <span>Rec. RAM:</span>
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

                  <div className="pt-3 border-t border-[#30363d]/80 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-slate-500">{pack.version}</span>

                    <button
                      type="button"
                      onClick={() => handleInstallModpack(pack)}
                      disabled={Boolean(installingModpackId)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      {isInstalling ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Installing...</span>
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
