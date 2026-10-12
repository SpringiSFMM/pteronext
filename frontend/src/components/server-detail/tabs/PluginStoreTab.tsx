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

export const PluginStoreTab: React.FC = () => {
  const { selectedServer, createFile, loadDirectory, addToast } = useApp();
  const { t, language } = useTranslation();

  const [query, setQuery] = useState('');
  const [plugins, setPlugins] = useState<ModrinthProject[]>(DEFAULT_POPULAR_PLUGINS);
  const [isLoading, setIsLoading] = useState(false);
  const [installedMap, setInstalledMap] = useState<Record<string, boolean>>({});
  const [activeCategory, setActiveCategory] = useState<string>('spigot');

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
          ["project_type:plugin"],
          ["categories:paper", "categories:spigot", "categories:purpur", "categories:bukkit"]
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
      // Fallback to local high-quality catalog if network is restricted
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

  // 1-Click Install with real remote download to server disk
  const handleInstall = async (plugin: ModrinthProject) => {
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
        console.warn('Modrinth API lookup error:', e);
      }

      if (!downloadUrl) {
        throw new Error(`Could not find a downloadable .jar build for ${plugin.title}.`);
      }

      // Stream remote jar file directly to server's /plugins volume
      const result = await api.files.downloadRemote(
        selectedServer.uuid,
        downloadUrl,
        '/plugins',
        filename
      );

      // Refresh real file metadata from node filesystem
      await loadDirectory('/plugins');

      const sizeStr = result?.file?.size
        ? `${(result.file.size / (1024 * 1024)).toFixed(2)} MB`
        : 'package ready';

      addToast({
        title: `${plugin.title} Installed!`,
        description: `Successfully saved "${filename}" (${sizeStr}) to /plugins/. Restart server to load.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Plugin install failure:', err);
      addToast({
        title: 'Install Error',
        description: err?.message || 'Failed to download plugin jar to server storage.',
        type: 'error',
      });
    }
  };

  const filteredList = plugins.filter((item) => {
    if (activeCategory === 'all') return true;
    return item.categories.includes(activeCategory);
  });

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-[#11141a] border border-[#30363d] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
              Free Open Ecosystem (No API Key Required)
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            <span>{language === 'de' ? 'Plugin & Modpack Store' : 'Plugin & Modpack Store'}</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-xl">
            {language === 'de'
              ? 'Durchsuche und installiere Community-Plugins, Optimierungen und Tools mit 1 Klick direkt in das /plugins/ Verzeichnis über Modrinth.'
              : 'Browse and 1-click install community plugins, performance optimizations, and mods directly into your server’s file system via the Modrinth open registry.'}
          </p>
        </div>

        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={language === 'de' ? 'Suche LuckPerms, Geyser, Chunky...' : 'Search LuckPerms, Geyser...'}
              className="w-full bg-[#0d1017] border border-[#30363d] focus:border-zinc-500 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold transition-all shadow-sm flex-shrink-0"
          >
            {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (language === 'de' ? 'Suchen' : 'Search')}
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
                ? 'bg-zinc-100 border-zinc-100 text-zinc-900 font-bold'
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
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
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

                {/* Compatibility Badges */}
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

              {/* Install Action */}
              <div className="pt-3 border-t border-[#30363d]/80 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500">
                  Target: /plugins
                </span>

                <button
                  type="button"
                  onClick={() => handleInstall(item)}
                  disabled={isInstalled}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shadow-sm ${
                    isInstalled
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-zinc-100 hover:bg-white text-zinc-900 active:scale-95'
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
  );
};
