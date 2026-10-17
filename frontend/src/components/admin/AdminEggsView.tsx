import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Package,
  Plus,
  Upload,
  Trash2,
  Terminal,
  Code2,
  Files,
  Inbox,
  CheckCircle2,
  FileCode,
  Layers,
  Sparkles,
  Server,
  Database,
  Gamepad2,
  Cpu,
  Bot,
  Globe,
  Radio,
  Edit3,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ShoppingCart,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { AdminMarketplaceModal } from './AdminMarketplaceModal';
import { useTranslation } from '../../i18n/useTranslation';
import { AdminEgg } from '../../types';

const NEST_ICONS = [
  { id: 'gamepad', label: 'Gaming', icon: Gamepad2 },
  { id: 'server', label: 'Server', icon: Server },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'bot', label: 'Discord / Bot', icon: Bot },
  { id: 'globe', label: 'Web / API', icon: Globe },
  { id: 'radio', label: 'Voice / Media', icon: Radio },
  { id: 'cpu', label: 'Compute', icon: Cpu },
  { id: 'package', label: 'General', icon: Package },
];

export const AdminEggsView: React.FC = () => {
  const {
    adminNests,
    adminEggs,
    adminLoading,
    createNest,
    deleteNest,
    importEgg,
    deleteEgg,
    createEgg,
    updateEgg,
    addToast,
  } = useApp();
  const { language } = useTranslation();

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'nest' | 'egg'; id: string; name: string } | null>(null);
  const [isDeletingTarget, setIsDeletingTarget] = useState(false);

  const [selectedNestId, setSelectedNestId] = useState<string>('');
  const [isCreateNestOpen, setIsCreateNestOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'installed' | 'marketplace'>('installed');
  const [isEggEditorOpen, setIsEggEditorOpen] = useState(false);
  const [editingEgg, setEditingEgg] = useState<AdminEgg | null>(null);

  // Redesigned Nest Form State
  const [nestName, setNestName] = useState('');
  const [nestSlug, setNestSlug] = useState('');
  const [nestDescription, setNestDescription] = useState('');
  const [selectedNestIcon, setSelectedNestIcon] = useState('gamepad');
  const [isCreatingNest, setIsCreatingNest] = useState(false);

  // Import form state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJson, setImportJson] = useState('');
  const [importNestId, setImportNestId] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Egg Deploy Script & Details Form State
  const [eggEditorTab, setEggEditorTab] = useState<'deploy' | 'runtime' | 'general'>('deploy');
  const [eggName, setEggName] = useState('');
  const [eggDescription, setEggDescription] = useState('');
  const [eggStartup, setEggStartup] = useState('');
  const [eggDockerImage, setEggDockerImage] = useState('ghcr.io/pterodactyl/yolks:java_17');
  const [eggScriptContainer, setEggScriptContainer] = useState('ghcr.io/pterodactyl/installers:alpine');
  const [eggScriptEntry, setEggScriptEntry] = useState('ash');
  const [eggScriptInstall, setEggScriptInstall] = useState(
    '#!/bin/ash\n# Installation script executed by Wings\napk add --no-cache curl jq\n\necho "Downloading server files..."\n'
  );
  const [isSavingEgg, setIsSavingEgg] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Auto-slug generation for Nest
  const handleNestNameChange = (val: string) => {
    setNestName(val);
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setNestSlug(slug);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Keep the selected nest valid
  useEffect(() => {
    if (adminNests.length === 0) {
      setSelectedNestId('');
      return;
    }
    if (!adminNests.some((n) => n.id === selectedNestId)) {
      setSelectedNestId(adminNests[0].id);
    }
  }, [adminNests, selectedNestId]);

  const selectedNest = adminNests.find((n) => n.id === selectedNestId);

  const filteredEggs = useMemo(
    () => adminEggs.filter((egg) => egg.nestId === selectedNestId),
    [adminEggs, selectedNestId]
  );

  const handleCreateNest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nestName.trim()) return;
    setIsCreatingNest(true);
    const ok = await createNest({
      name: nestName.trim(),
      description: nestDescription.trim(),
      slug: nestSlug.trim(),
    });
    setIsCreatingNest(false);
    if (ok) {
      setIsCreateNestOpen(false);
      setNestName('');
      setNestSlug('');
      setNestDescription('');
      setSelectedNestIcon('gamepad');
    }
  };

  const handleDeleteNest = (id: string, name: string) => {
    setDeleteTarget({ type: 'nest', id, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeletingTarget(true);
    try {
      if (deleteTarget.type === 'nest') {
        await deleteNest(deleteTarget.id);
      } else {
        await deleteEgg(deleteTarget.id);
      }
      setDeleteTarget(null);
    } finally {
      setIsDeletingTarget(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasFile = !!importFile;
    const hasJson = importJson.trim().length > 0;
    if (!hasFile && !hasJson) {
      addToast({
        title: 'Nothing to Import',
        description: 'Select an egg export file or paste the PTDL JSON first.',
        type: 'warning',
      });
      return;
    }

    setIsImporting(true);
    const ok = await importEgg({
      file: hasFile ? importFile! : undefined,
      json: hasFile ? undefined : importJson,
      nestId: importNestId || selectedNestId || undefined,
    });
    setIsImporting(false);

    if (ok) {
      setIsImportOpen(false);
      setImportFile(null);
      setImportJson('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openEggEditor = (egg?: AdminEgg) => {
    if (egg) {
      setEditingEgg(egg);
      setEggName(egg.name);
      setEggDescription(egg.description || '');
      setEggStartup(egg.startup || '');
      const firstImage = Object.values(egg.dockerImages)[0] || 'ghcr.io/pterodactyl/yolks:java_17';
      setEggDockerImage(firstImage);
      setEggScriptContainer(egg.scriptContainer || 'ghcr.io/pterodactyl/installers:alpine');
      setEggScriptEntry(egg.scriptEntry || 'ash');
      setEggScriptInstall(
        egg.scriptInstall ||
          '#!/bin/ash\n# Installation script executed by Wings\napk add --no-cache curl jq\n\necho "Deploying server binary..."\n'
      );
    } else {
      setEditingEgg(null);
      setEggName('');
      setEggDescription('');
      setEggStartup('java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar');
      setEggDockerImage('ghcr.io/pterodactyl/yolks:java_17');
      setEggScriptContainer('ghcr.io/pterodactyl/installers:alpine');
      setEggScriptEntry('ash');
      setEggScriptInstall(
        '#!/bin/ash\n# Installation script executed by Wings\napk add --no-cache curl jq\n\necho "Deploying server binary..."\n'
      );
    }
    setEggEditorTab('deploy');
    setIsEggEditorOpen(true);
  };

  const handleSaveEgg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eggName.trim()) {
      addToast({
        title: 'Name Required',
        description: 'Please specify an egg template name.',
        type: 'error',
      });
      return;
    }

    setIsSavingEgg(true);
    try {
      if (editingEgg) {
        // Update existing egg
        const ok = await updateEgg(editingEgg.id, {
          name: eggName.trim(),
          description: eggDescription.trim(),
          startup_command: eggStartup.trim(),
          docker_images: { default: eggDockerImage.trim() },
          script_install: eggScriptInstall,
          script_container: eggScriptContainer.trim(),
          script_entry: eggScriptEntry.trim(),
        });
        if (ok) setIsEggEditorOpen(false);
      } else {
        // Create new egg
        const ok = await createEgg({
          nest_id: Number(selectedNestId),
          name: eggName.trim(),
          description: eggDescription.trim(),
          startup_command: eggStartup.trim(),
          docker_images: { default: eggDockerImage.trim() },
          script_install: eggScriptInstall,
          script_container: eggScriptContainer.trim(),
          script_entry: eggScriptEntry.trim(),
        });
        if (ok) setIsEggEditorOpen(false);
      }
    } finally {
      setIsSavingEgg(false);
    }
  };

  const openImport = () => {
    setImportNestId(selectedNestId);
    setIsImportOpen(true);
  };

  const SelectedIconComponent =
    NEST_ICONS.find((i) => i.id === selectedNestIcon)?.icon || Package;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Nests & Egg Templates
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Manage game templates, container deploy scripts, and PTDL distributions
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
          <button
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600/25 to-blue-600/20 hover:from-purple-600/35 hover:to-blue-600/30 border border-purple-500/40 hover:border-purple-400 text-xs font-semibold text-purple-200 hover:text-white transition-all shadow-md shadow-purple-900/10 active:scale-95"
            onClick={() => setIsMarketplaceOpen(true)}
          >
            <ShoppingCart className="w-4 h-4 text-purple-400" />
            <span>🛒 Aus Marketplace importieren</span>
          </button>
          <button
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-xs font-medium text-slate-300 hover:text-white transition-colors"
            onClick={() => setIsCreateNestOpen(true)}
          >
            <Plus className="w-4 h-4 text-purple-400" />
            <span>New Nest</span>
          </button>
          <button
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-xs font-medium text-slate-300 hover:text-white transition-colors"
            onClick={openImport}
          >
            <Upload className="w-4 h-4 text-emerald-400" />
            <span>Import Egg</span>
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-purple-600/20 active:scale-95"
            onClick={() => openEggEditor()}
          >
            <FileCode className="w-4 h-4" />
            <span>New Egg / Script</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs: Installed Eggs vs Ecosystem Marketplace */}
      <div className="flex items-center gap-2 border-b border-[#30363d] pb-3">
        <button
          onClick={() => setActiveViewTab('installed')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeViewTab === 'installed'
              ? 'bg-[#1c2128] text-white border border-[#484f58] shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-[#161b22]'
          }`}
        >
          <Package className="w-4 h-4 text-purple-400" />
          <span>{language === 'de' ? 'Nests & Lokale Eggs' : 'Nests & Installed Eggs'}</span>
        </button>
        <button
          onClick={() => setIsMarketplaceOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-purple-300 hover:text-white hover:bg-purple-500/10 border border-purple-500/30 transition-all"
        >
          <ShoppingCart className="w-4 h-4 text-purple-400" />
          <span>{language === 'de' ? '🛒 PteroNext Marketplace Store' : '🛒 PteroNext Marketplace Store'}</span>
          <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono">
            Ecosystem
          </span>
        </button>
      </div>

      {/* Nest Category Switcher */}
      {adminNests.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {adminNests.map((nest) => {
            const isActive = selectedNestId === nest.id;
            return (
              <div
                key={nest.id}
                onClick={() => setSelectedNestId(nest.id)}
                className={`group relative p-4 rounded-2xl border cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[#1c2128] border-purple-500/60 shadow-lg shadow-purple-500/5'
                    : 'bg-[#161b22] border-[#30363d] hover:bg-[#1c2128] hover:border-[#484f58]'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-2.5 rounded-xl border shrink-0 ${
                        isActive
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                          : 'bg-[#21262d] border-[#30363d] text-slate-400'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-white truncate">{nest.name}</h3>
                      <span className="text-[10px] font-mono text-slate-400">
                        {nest.eggsCount} egg{nest.eggsCount === 1 ? '' : 's'} · {nest.slug}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNest(nest.id, nest.name);
                    }}
                    title="Delete nest"
                    className="p-1.5 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2">{nest.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Eggs in Selected Nest */}
      {selectedNest && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Eggs in “{selectedNest.name}”
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-[#21262d] text-slate-300 font-mono text-xs border border-[#30363d]">
                {filteredEggs.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 font-mono"
                onClick={() => openEggEditor()}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Egg</span>
              </button>
            </div>
          </div>

          {filteredEggs.length === 0 ? (
            <div className="p-10 text-center rounded-2xl bg-[#161b22] border border-[#30363d]">
              <Files className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No eggs in this nest</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto mb-4">
                Import an existing PTDL egg template or create one with a custom container deploy script.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => openEggEditor()}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-bold"
                >
                  Create Custom Egg
                </button>
                <button
                  onClick={openImport}
                  className="px-3.5 py-1.5 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-300 text-xs font-medium border border-[#30363d]"
                >
                  Import PTDL
                </button>
                <button
                  onClick={() => setIsMarketplaceOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 hover:text-white text-xs font-semibold border border-purple-500/40 flex items-center gap-1.5 transition-all"
                >
                  <ShoppingCart className="w-3.5 h-3.5 text-purple-400" />
                  <span>🛒 Aus Marketplace</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredEggs.map((egg) => {
                const hasDeployScript = !!egg.scriptInstall && egg.scriptInstall.trim().length > 0;
                return (
                  <div
                    key={egg.id}
                    className="p-5 rounded-2xl bg-[#161b22] border border-[#30363d] hover:border-[#484f58] transition-all space-y-4 flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white truncate">{egg.name}</h3>
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            {egg.author || 'PteroNext Community'} • {egg.version || '1.0.0'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => openEggEditor(egg)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                            title="Edit Egg & Deploy Script"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ type: 'egg', id: egg.id, name: egg.name })}
                            title="Delete egg"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2">{egg.description}</p>

                      {/* Startup Command */}
                      <div className="mt-4 pt-3 border-t border-[#30363d]/80 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5 text-slate-500" />
                            <span>Startup Invocation:</span>
                          </div>
                          <button
                            onClick={() => handleCopy(egg.startup, `egg-startup-${egg.id}`)}
                            className="text-slate-400 hover:text-white"
                          >
                            {copiedKey === `egg-startup-${egg.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <pre className="p-2.5 rounded-xl bg-[#0d1117] border border-[#30363d] text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                          {egg.startup || 'N/A'}
                        </pre>
                      </div>

                      {/* Deploy Script Status & Badge */}
                      <div className="mt-3 p-2.5 rounded-xl bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCode className="w-4 h-4 text-purple-400" />
                          <div>
                            <span className="text-[11px] font-mono text-white block">
                              Deploy Script (Installer)
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Container: {egg.scriptContainer || 'ghcr.io/pterodactyl/installers:alpine'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => openEggEditor(egg)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-all ${
                            hasDeployScript
                              ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                          }`}
                        >
                          {hasDeployScript ? 'Configure Script' : '+ Add Script'}
                        </button>
                      </div>

                      {/* Docker image */}
                      <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400">
                        <span className="truncate pr-2">
                          Docker: {Object.values(egg.dockerImages)[0] || 'Default'}
                        </span>
                        <span className="text-[11px] text-slate-500 flex-shrink-0">
                          {egg.variables?.length || 0} vars
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Redesigned Nest Modal ── */}
      <Modal
        isOpen={isCreateNestOpen}
        onClose={() => setIsCreateNestOpen(false)}
        title="Create Game / App Nest"
        subtitle="Group related game servers, services, and software containers"
        icon={<Layers className="w-4 h-4 text-purple-400" />}
        badge="NEST SCHEMA"
        badgeColor="purple"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateNest} className="space-y-5">
          {/* Category Icon Selector */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-2 font-medium">
              Nest Category & Icon
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {NEST_ICONS.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedNestIcon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedNestIcon(item.id)}
                    className={`px-3 py-2.5 rounded-xl border flex items-center gap-2.5 text-left transition-all ${
                      isSelected
                        ? 'bg-purple-500/15 border-purple-500 text-purple-300 shadow-md shadow-purple-500/20 font-semibold'
                        : 'bg-[#0d1117] border-[#30363d] text-slate-300 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-purple-400" />
                    <span className="text-xs font-sans truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Nest Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Minecraft, Rust, Node.js"
                value={nestName}
                onChange={(e) => handleNestNameChange(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                URL Identifier / Slug
              </label>
              <input
                type="text"
                placeholder="minecraft-servers"
                value={nestSlug}
                onChange={(e) => setNestSlug(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-purple-300 font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
              Nest Description
            </label>
            <textarea
              rows={2}
              placeholder="Primary collection of server eggs for Java and Bedrock editions..."
              value={nestDescription}
              onChange={(e) => setNestDescription(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
            />
          </div>

          {/* Live Nest Preview */}
          <div className="p-3.5 bg-[#0d1117] rounded-xl border border-[#30363d] space-y-2">
            <span className="text-[10px] font-mono uppercase text-slate-500 block font-semibold">
              Preview in Grid
            </span>
            <div className="p-3 rounded-xl bg-[#161b22] border border-purple-500/40 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <SelectedIconComponent className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white truncate">
                  {nestName || 'Nest Title'}
                </h4>
                <p className="text-[11px] text-slate-400 font-mono">
                  0 eggs · {nestSlug || 'slug-preview'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
              onClick={() => setIsCreateNestOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreatingNest || !nestName.trim()}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-purple-600/20 active:scale-95"
            >
              {isCreatingNest ? 'Creating...' : 'Create Nest'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Egg Editor & Deploy Script Modal ── */}
      <Modal
        isOpen={isEggEditorOpen}
        onClose={() => setIsEggEditorOpen(false)}
        title={editingEgg ? `Configure Egg: ${editingEgg.name}` : 'New Egg Template & Deploy Script'}
        subtitle="Manage startup parameters, Docker environment, and container installation script"
        icon={<FileCode className="w-4 h-4 text-purple-400" />}
        badge="DEPLOY SCRIPT"
        badgeColor="purple"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveEgg} className="space-y-4">
          {/* Subtabs inside Modal */}
          <div className="flex items-center gap-2 border-b border-[#30363d]">
            <button
              type="button"
              onClick={() => setEggEditorTab('deploy')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all -mb-px ${
                eggEditorTab === 'deploy'
                  ? 'border-purple-400 text-purple-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Deploy Script (Installer)</span>
            </button>

            <button
              type="button"
              onClick={() => setEggEditorTab('runtime')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all -mb-px ${
                eggEditorTab === 'runtime'
                  ? 'border-purple-400 text-purple-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Startup & Docker</span>
            </button>

            <button
              type="button"
              onClick={() => setEggEditorTab('general')}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all -mb-px ${
                eggEditorTab === 'general'
                  ? 'border-purple-400 text-purple-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>General Info</span>
            </button>
          </div>

          {/* Tab 1: Deploy Script */}
          {eggEditorTab === 'deploy' && (
            <div className="space-y-4">
              <div className="p-3 bg-purple-500/5 rounded-xl border border-purple-500/20 text-xs text-slate-300">
                <span className="text-purple-400 font-semibold font-mono block mb-0.5">
                  Wings Container Installation Lifecycle
                </span>
                This script runs inside a temporary Docker container when the server is created or
                reinstalled. It downloads files and prepares the environment before the server starts.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                    Installer Container Image *
                  </label>
                  <input
                    type="text"
                    value={eggScriptContainer}
                    onChange={(e) => setEggScriptContainer(e.target.value)}
                    placeholder="ghcr.io/pterodactyl/installers:alpine"
                    className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                    Installer Entrypoint *
                  </label>
                  <input
                    type="text"
                    value={eggScriptEntry}
                    onChange={(e) => setEggScriptEntry(e.target.value)}
                    placeholder="ash or bash"
                    className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono uppercase text-slate-300 font-medium">
                    Deploy / Install Script (Bash / Ash)
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Executed in /mnt/server
                  </span>
                </div>
                <textarea
                  rows={9}
                  value={eggScriptInstall}
                  onChange={(e) => setEggScriptInstall(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl p-3.5 text-xs text-emerald-400 font-mono focus:outline-none transition-colors leading-relaxed selection:bg-purple-500/30 font-mono"
                  placeholder="#!/bin/ash&#10;apk add --no-cache curl"
                />
              </div>
            </div>
          )}

          {/* Tab 2: Runtime & Startup */}
          {eggEditorTab === 'runtime' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Default Docker Container Image *
                </label>
                <input
                  type="text"
                  value={eggDockerImage}
                  onChange={(e) => setEggDockerImage(e.target.value)}
                  placeholder="ghcr.io/pterodactyl/yolks:java_17"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono uppercase text-slate-300 font-medium">
                    Startup Command Template *
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {'{{SERVER_MEMORY}}'}, {'{{SERVER_PORT}}'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={eggStartup}
                  onChange={(e) => setEggStartup(e.target.value)}
                  placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl p-3.5 text-xs text-emerald-400 font-mono focus:outline-none transition-colors leading-relaxed"
                />
              </div>
            </div>
          )}

          {/* Tab 3: General Info */}
          {eggEditorTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Egg Name *
                </label>
                <input
                  type="text"
                  required
                  value={eggName}
                  onChange={(e) => setEggName(e.target.value)}
                  placeholder="e.g. Paper Minecraft 1.20"
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={eggDescription}
                  onChange={(e) => setEggDescription(e.target.value)}
                  placeholder="High-performance Minecraft fork with spigot compatibility..."
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
              onClick={() => setIsEggEditorOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingEgg || !eggName.trim()}
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-purple-600/20 active:scale-95"
            >
              {isSavingEgg ? 'Saving...' : editingEgg ? 'Update Egg & Deploy Script' : 'Create Egg'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Import Egg Modal ── */}
      <Modal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        title="Import Egg Template"
        subtitle="Upload a PTDL_v1 / PTDL_v2 export file or paste its JSON"
        icon={<Upload className="w-4 h-4 text-emerald-400" />}
        badge="IMPORT JSON"
        badgeColor="emerald"
        maxWidth="lg"
      >
        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
              Target Nest
            </label>
            <select
              value={importNestId}
              onChange={(e) => setImportNestId(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
            >
              <option value="">— Use selected nest —</option>
              {adminNests.map((nest) => (
                <option key={nest.id} value={nest.id}>
                  {nest.name} ({nest.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
              Egg Export File (.json)
            </label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) setImportFile(file);
              }}
              className="rounded-xl border border-dashed border-[#484f58] bg-[#0d1117] p-6 text-center transition-colors hover:border-purple-400/60"
            >
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              {importFile ? (
                <div className="flex items-center justify-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-white font-mono">{importFile.name}</span>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-rose-400 underline ml-2"
                    onClick={() => {
                      setImportFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    remove
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Drop the egg export here or{' '}
                  <button
                    type="button"
                    className="text-purple-400 underline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse files
                  </button>
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setImportFile(file);
                }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
              …or paste JSON
            </label>
            <textarea
              rows={5}
              placeholder='{ "meta": { "version": "PTDL_v2" }, "name": "...", ... }'
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-purple-500 rounded-xl p-3 text-xs text-white font-mono focus:outline-none transition-colors"
              disabled={!!importFile}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
              onClick={() => setIsImportOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-purple-600/20 active:scale-95"
              disabled={isImporting || (!importFile && !importJson.trim())}
            >
              {isImporting ? 'Importing...' : 'Import Egg'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cyber-Glass Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title={
          deleteTarget?.type === 'nest'
            ? language === 'de'
              ? 'Nest löschen'
              : 'Delete Nest'
            : language === 'de'
            ? 'Egg löschen'
            : 'Delete Egg'
        }
        itemName={deleteTarget?.name}
        description={
          deleteTarget?.type === 'nest'
            ? language === 'de'
              ? `Möchtest du das Nest "${deleteTarget?.name}" wirklich löschen? Nester, die noch Eggs enthalten, können nicht gelöscht werden.`
              : `Are you sure you want to delete nest "${deleteTarget?.name}"? Nests containing eggs cannot be deleted.`
            : language === 'de'
            ? `Möchtest du das Egg "${deleteTarget?.name}" wirklich dauerhaft löschen?`
            : `Are you sure you want to permanently delete egg "${deleteTarget?.name}"?`
        }
        isDeleting={isDeletingTarget}
      />

      {/* ── PteroNext Ecosystem Marketplace Modal ── */}
      <AdminMarketplaceModal
        isOpen={isMarketplaceOpen}
        onClose={() => setIsMarketplaceOpen(false)}
        defaultNestId={selectedNestId}
      />
    </div>
  );
};
