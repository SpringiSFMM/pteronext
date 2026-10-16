import React, { useEffect, useMemo, useState } from 'react';
import {
  ShoppingCart,
  Search,
  Download,
  Sparkles,
  CheckCircle2,
  Package,
  Layers,
  Terminal,
  Cpu,
  Globe,
  Bot,
  Database,
  Gamepad2,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  FileCode,
  ExternalLink,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import {
  MarketplaceEgg,
  MarketplaceCategory,
  MARKETPLACE_CATEGORIES,
  fetchMarketplaceEggs,
  buildEggExportJson,
} from '../../data/marketplaceData';

interface AdminMarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultNestId?: string;
}

export const AdminMarketplaceModal: React.FC<AdminMarketplaceModalProps> = ({
  isOpen,
  onClose,
  defaultNestId,
}) => {
  const { adminNests, importEgg, addToast, refreshAdminData } = useApp();
  const { language } = useTranslation();

  const [eggs, setEggs] = useState<MarketplaceEgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory>('all');
  const [targetNestId, setTargetNestId] = useState<string>('');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedSlugs, setImportedSlugs] = useState<Set<string>>(new Set());
  const [expandedEggId, setExpandedEggId] = useState<string | null>(null);

  // Set default target nest when open or nests change
  useEffect(() => {
    if (defaultNestId && adminNests.some((n) => n.id === defaultNestId)) {
      setTargetNestId(defaultNestId);
    } else if (adminNests.length > 0 && !targetNestId) {
      setTargetNestId(adminNests[0].id);
    }
  }, [defaultNestId, adminNests, targetNestId]);

  // Load eggs from API / cache
  const loadEggs = async () => {
    setLoading(true);
    try {
      const items = await fetchMarketplaceEggs();
      setEggs(items);
    } catch (err) {
      console.error('Failed fetching marketplace eggs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadEggs();
    }
  }, [isOpen]);

  // Filter eggs based on search query and category
  const filteredEggs = useMemo(() => {
    return eggs.filter((egg) => {
      // Category filter
      if (selectedCategory !== 'all' && egg.category !== selectedCategory) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = egg.name.toLowerCase().includes(q);
        const matchDesc =
          egg.description_de.toLowerCase().includes(q) ||
          egg.description_en.toLowerCase().includes(q);
        const matchAuthor = (egg.author || '').toLowerCase().includes(q);
        const matchDocker = (egg.docker_image || '').toLowerCase().includes(q);
        const matchSub = (egg.subCategory || '').toLowerCase().includes(q);

        if (!matchName && !matchDesc && !matchAuthor && !matchDocker && !matchSub) {
          return false;
        }
      }

      return true;
    });
  }, [eggs, selectedCategory, searchQuery]);

  // 1-Click Import Action
  const handleImportToPanel = async (egg: MarketplaceEgg) => {
    if (!targetNestId && adminNests.length > 0) {
      setTargetNestId(adminNests[0].id);
    }

    const effectiveNestId = targetNestId || (adminNests[0]?.id ? String(adminNests[0].id) : undefined);
    if (!effectiveNestId) {
      addToast({
        title: language === 'de' ? 'Kein Nest vorhanden' : 'No Nest Available',
        description:
          language === 'de'
            ? 'Bitte erstelle zuerst ein Nest im Admin-Bereich, um Eggs zu importieren.'
            : 'Please create at least one Nest first before importing eggs.',
        type: 'warning',
      });
      return;
    }

    setImportingId(egg.id);

    try {
      // 1. Build authentic PTDL JSON export
      const eggJsonString = buildEggExportJson(egg);

      // 2. Dispatch to backend import endpoint
      const success = await importEgg({
        json: eggJsonString,
        nestId: effectiveNestId,
      });

      if (success) {
        const destNest = adminNests.find((n) => n.id === effectiveNestId);
        const destNestName = destNest ? destNest.name : 'Nest #' + effectiveNestId;

        addToast({
          title: language === 'de' ? 'Import erfolgreich' : 'Import Successful',
          description:
            language === 'de'
              ? `Egg [${egg.name}] erfolgreich in Nest "${destNestName}" importiert!`
              : `Egg [${egg.name}] successfully imported into Nest "${destNestName}"!`,
          type: 'success',
        });

        setImportedSlugs((prev) => new Set(prev).add(egg.slug));
        await refreshAdminData();
      }
    } catch (err: any) {
      console.error('Import egg error:', err);
      addToast({
        title: language === 'de' ? 'Import fehlgeschlagen' : 'Import Failed',
        description: err?.message || 'The egg JSON could not be processed by the server.',
        type: 'error',
      });
    } finally {
      setImportingId(null);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'games':
        return <Gamepad2 className="w-4 h-4 text-emerald-400" />;
      case 'bots':
        return <Bot className="w-4 h-4 text-purple-400" />;
      case 'web':
        return <Globe className="w-4 h-4 text-cyan-400" />;
      case 'databases':
        return <Database className="w-4 h-4 text-amber-400" />;
      default:
        return <Package className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="PteroNext Ecosystem Store"
      subtitle={
        language === 'de'
          ? 'Geprüfte Community- & Official-Eggs per 1-Klick direkt in dein Panel importieren'
          : 'Browse and 1-click import verified game and application templates directly into your panel'
      }
      icon={<ShoppingCart className="w-5 h-5 text-purple-400" />}
      badge="PTERONEXT STORE"
      badgeColor="purple"
      maxWidth="5xl"
    >
      <div className="space-y-5">
        {/* Top Control Bar: Search, Category Filters, Target Nest */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#161b22] p-3.5 rounded-2xl border border-[#30363d]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'de'
                  ? 'Egg suchen (Minecraft, Rust, Discord Bot, Redis...)'
                  : 'Search eggs (Minecraft, Rust, Discord bot, Redis...)'
              }
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Target Nest Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase text-slate-400 whitespace-nowrap">
              {language === 'de' ? 'Ziel-Nest:' : 'Target Nest:'}
            </span>
            <select
              value={targetNestId}
              onChange={(e) => setTargetNestId(e.target.value)}
              className="bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-colors"
            >
              {adminNests.map((nest) => (
                <option key={nest.id} value={nest.id}>
                  {nest.name} ({nest.slug})
                </option>
              ))}
            </select>

            <button
              onClick={loadEggs}
              disabled={loading}
              title={language === 'de' ? 'Neu laden' : 'Refresh'}
              className="p-2 rounded-xl bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {MARKETPLACE_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20 font-semibold'
                    : 'bg-[#161b22] hover:bg-[#21262d] text-slate-400 hover:text-white border border-[#30363d]'
                }`}
              >
                <span>{language === 'de' ? cat.label_de : cat.label_en}</span>
              </button>
            );
          })}
        </div>

        {/* Eggs Grid */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
            <p className="text-xs text-slate-400 font-mono">
              {language === 'de'
                ? 'Verbinde mit PteroNext Store (pteronext.com)...'
                : 'Connecting to PteroNext Store (pteronext.com)...'}
            </p>
          </div>
        ) : filteredEggs.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-[#161b22] border border-[#30363d] space-y-2">
            <Package className="w-10 h-10 text-slate-600 mx-auto" />
            <h3 className="text-sm font-semibold text-white">
              {language === 'de' ? 'Keine Eggs gefunden' : 'No eggs found'}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {language === 'de'
                ? 'Passe deine Suchbegriffe an oder wähle eine andere Kategorie.'
                : 'Try adjusting your search query or select another category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[58vh] overflow-y-auto pr-1">
            {filteredEggs.map((egg) => {
              const isImportingThis = importingId === egg.id;
              const hasBeenImported = importedSlugs.has(egg.slug);
              const isExpanded = expandedEggId === egg.id;

              return (
                <div
                  key={egg.id}
                  className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] hover:border-purple-500/50 transition-all flex flex-col justify-between group space-y-3 shadow-md shadow-black/20"
                >
                  {/* Top: Icon, Title, Author & Verified Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2.5 rounded-xl bg-[#21262d] border border-[#30363d] shrink-0">
                          {getCategoryIcon(egg.category)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-sm font-bold text-white truncate">{egg.name}</h4>
                            {egg.verified && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 font-semibold">
                                <Sparkles className="w-2.5 h-2.5" />
                                Verified
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono text-slate-400 truncate">
                            {egg.author} • v{egg.version}
                          </p>
                        </div>
                      </div>

                      {/* Downloads & Stars Pill */}
                      <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full shrink-0">
                        ★ {egg.stars || 40} · {egg.downloads} dl
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                      {language === 'de' ? egg.description_de : egg.description_en}
                    </p>

                    {/* Tags / Docker image */}
                    <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#0d1117] border border-[#30363d] text-slate-400 truncate max-w-[200px]">
                        🐳 {egg.docker_image}
                      </span>
                      {egg.variables && egg.variables.length > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#0d1117] border border-[#30363d] text-cyan-400">
                          {egg.variables.length} Vars
                        </span>
                      )}
                      {egg.subCategory && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {egg.subCategory}
                        </span>
                      )}
                    </div>

                    {/* Expanded details view (variables & startup command) */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-[#30363d] space-y-2 text-xs">
                        <div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                            Startup Command:
                          </span>
                          <div className="p-2 rounded-lg bg-[#0d1117] border border-[#30363d] font-mono text-[11px] text-purple-300 break-all">
                            {egg.startup || 'N/A'}
                          </div>
                        </div>

                        {egg.variables && egg.variables.length > 0 && (
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">
                              Template Variables ({egg.variables.length}):
                            </span>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {egg.variables.map((v) => (
                                <div
                                  key={v.env_variable}
                                  className="p-1.5 rounded-lg bg-[#0d1117] border border-[#30363d] flex items-center justify-between text-[11px] font-mono"
                                >
                                  <span className="text-slate-300">{v.env_variable}</span>
                                  <span className="text-purple-400 truncate max-w-[150px]">
                                    {v.default_value || '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="pt-3 border-t border-[#30363d]/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => setExpandedEggId(isExpanded ? null : egg.id)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 font-mono transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <span>Weniger</span>
                          <ChevronUp className="w-3 h-3" />
                        </>
                      ) : (
                        <>
                          <span>Details</span>
                          <ChevronDown className="w-3 h-3" />
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleImportToPanel(egg)}
                      disabled={isImportingThis}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold transition-all shadow-md active:scale-95 ${
                        hasBeenImported
                          ? 'bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
                          : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/20'
                      }`}
                    >
                      {isImportingThis ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{language === 'de' ? 'Importiere...' : 'Importing...'}</span>
                        </>
                      ) : hasBeenImported ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{language === 'de' ? 'Erneut importieren' : 'Import Again'}</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>{language === 'de' ? 'In Panel importieren' : 'Import to Panel'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
