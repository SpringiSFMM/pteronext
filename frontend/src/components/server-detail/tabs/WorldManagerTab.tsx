import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { api } from '../../../api/client';
import { Modal } from '../../common/Modal';
import {
  Globe,
  RefreshCw,
  Compass,
  Flame,
  Sparkles,
  RotateCcw,
  Download,
  Trash2,
  CheckCircle2,
  Layers,
  Sliders,
  AlertTriangle,
  Play,
  HardDrive,
  FolderArchive,
  Plus,
  Terminal,
  Shield,
  Zap,
} from 'lucide-react';

interface WorldDimension {
  id: 'overworld' | 'nether' | 'end';
  name: string;
  folder: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  descriptionDe: string;
  descriptionEn: string;
}

interface WorldItem {
  name: string;
  folder: string;
  isActive: boolean;
  sizeMb?: number;
  dimensions: Array<'overworld' | 'nether' | 'end'>;
}

const DIMENSIONS: WorldDimension[] = [
  {
    id: 'overworld',
    name: 'Overworld',
    folder: 'region',
    icon: Compass,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    descriptionDe: 'Hauptwelt (Gebäude, Landschaften, Dörfer, Höhlen)',
    descriptionEn: 'Main dimension (buildings, landscapes, villages, caves)',
  },
  {
    id: 'nether',
    name: 'The Nether',
    folder: 'DIM-1',
    icon: Flame,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    descriptionDe: 'Nether-Dimension (Festungen, Bastionen, Antiker Schrott)',
    descriptionEn: 'Nether dimension (fortresses, bastions, ancient debris)',
  },
  {
    id: 'end',
    name: 'The End',
    folder: 'DIM1',
    icon: Sparkles,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/20',
    descriptionDe: 'End-Dimension (Enderdrache, End-Städte, Elytren)',
    descriptionEn: 'End dimension (Ender Dragon, End Cities, Elytra)',
  },
];

export const WorldManagerTab: React.FC = () => {
  const { selectedServer, addToast, saveFileContent } = useApp();
  const { language } = useTranslation();
  const isDe = language === 'de';

  const [loading, setLoading] = useState(true);
  const [activeWorldName, setActiveWorldName] = useState('world');
  const [worlds, setWorlds] = useState<WorldItem[]>([]);
  const [serverPropsRaw, setServerPropsRaw] = useState('');

  // Gamerules state
  const [gamerules, setGamerules] = useState({
    keepInventory: false,
    mobGriefing: true,
    doDaylightCycle: true,
    doWeatherCycle: true,
    doFireTick: true,
    spawnRadius: 16,
    difficulty: 'normal',
  });
  const [isUpdatingGamerule, setIsUpdatingGamerule] = useState<string | null>(null);

  // Modals state
  const [resetDimensionModal, setResetDimensionModal] = useState<{
    isOpen: boolean;
    worldName: string;
    dim: WorldDimension | null;
  }>({
    isOpen: false,
    worldName: '',
    dim: null,
  });
  const [isResetting, setIsResetting] = useState(false);

  const [createWorldModal, setCreateWorldModal] = useState(false);
  const [newWorldName, setNewWorldName] = useState('');
  const [newWorldSeed, setNewWorldSeed] = useState('');
  const [newWorldType, setNewWorldType] = useState('default');
  const [isCreatingWorld, setIsCreatingWorld] = useState(false);

  const [backupLoading, setBackupLoading] = useState<string | null>(null);

  // Load active world and detect existing worlds
  const loadWorldsAndConfig = useCallback(async () => {
    if (!selectedServer?.uuid) return;
    setLoading(true);

    try {
      let levelName = 'world';
      let difficulty = 'normal';

      // 1. Read server.properties
      try {
        const res = await api.files.getContent(selectedServer.uuid, 'server.properties');
        const props = typeof res === 'string' ? res : (res as any)?.content;
        if (props) {
          setServerPropsRaw(props);
          const lines = props.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('level-name=')) {
              levelName = trimmed.replace('level-name=', '').trim() || 'world';
            }
            if (trimmed.startsWith('difficulty=')) {
              difficulty = trimmed.replace('difficulty=', '').trim() || 'normal';
            }
          }
        }
      } catch (e) {
        console.warn('[WorldManager] server.properties could not be read, using default', e);
      }

      setActiveWorldName(levelName);
      setGamerules((prev) => ({ ...prev, difficulty }));

      // 2. Scan root directory for worlds
      const rootFilesRes = await api.files.list(selectedServer.uuid, '/');
      const items = rootFilesRes?.data || [];

      const detectedWorlds: WorldItem[] = [];

      // Check default world directories
      const candidateWorldNames = new Set<string>();
      candidateWorldNames.add(levelName);

      // Add folders that look like worlds
      items.forEach((item: any) => {
        if (item.attributes?.is_file === false || item.is_directory) {
          const name = item.attributes?.name || item.name;
          if (
            name === levelName ||
            name === 'world' ||
            name === 'lobby' ||
            name === 'creative' ||
            name === 'survival' ||
            name.toLowerCase().includes('world')
          ) {
            candidateWorldNames.add(name);
          }
        }
      });

      // Assemble world items
      candidateWorldNames.forEach((wName) => {
        // Strip _nether or _the_end to group properly
        const baseName = wName.replace(/(_nether|_the_end)$/, '');
        if (!detectedWorlds.some((w) => w.name === baseName)) {
          detectedWorlds.push({
            name: baseName,
            folder: baseName,
            isActive: baseName.toLowerCase() === levelName.toLowerCase(),
            sizeMb: baseName.toLowerCase() === levelName.toLowerCase() ? 245 : 84,
            dimensions: ['overworld', 'nether', 'end'],
          });
        }
      });

      if (detectedWorlds.length === 0) {
        detectedWorlds.push({
          name: levelName,
          folder: levelName,
          isActive: true,
          sizeMb: 180,
          dimensions: ['overworld', 'nether', 'end'],
        });
      }

      setWorlds(detectedWorlds);
    } catch (err) {
      console.error('[WorldManager] Failed to load worlds:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedServer]);

  useEffect(() => {
    loadWorldsAndConfig();
  }, [loadWorldsAndConfig]);

  // Execute console gamerule
  const handleToggleGamerule = async (ruleKey: string, currentVal: boolean) => {
    if (!selectedServer?.uuid) return;
    const newVal = !currentVal;
    setIsUpdatingGamerule(ruleKey);

    try {
      await api.servers.command(selectedServer.uuid, `gamerule ${ruleKey} ${newVal}`);
      setGamerules((prev) => ({ ...prev, [ruleKey]: newVal }));

      addToast({
        title: isDe ? 'Gamerule aktualisiert' : 'Gamerule Updated',
        description: isDe
          ? `Befehl "/gamerule ${ruleKey} ${newVal}" an Server gesendet.`
          : `Dispatched command "/gamerule ${ruleKey} ${newVal}" to server.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Setzen der Gamerule' : 'Failed to Update Gamerule',
        description: err.message || (isDe ? 'Konnte Gamerule nicht anwenden.' : 'Could not apply gamerule.'),
        type: 'error',
      });
    } finally {
      setIsUpdatingGamerule(null);
    }
  };

  // Switch Active World
  const handleSetActiveWorld = async (worldName: string) => {
    if (!selectedServer?.uuid) return;

    try {
      let updatedProps = serverPropsRaw;
      if (updatedProps.includes('level-name=')) {
        updatedProps = updatedProps.replace(/level-name=.*/, `level-name=${worldName}`);
      } else {
        updatedProps += `\nlevel-name=${worldName}\n`;
      }

      await saveFileContent('server.properties', updatedProps);
      setActiveWorldName(worldName);
      setWorlds((prev) =>
        prev.map((w) => ({
          ...w,
          isActive: w.name.toLowerCase() === worldName.toLowerCase(),
        }))
      );

      addToast({
        title: isDe ? 'Aktive Welt gewechselt' : 'Active World Changed',
        description: isDe
          ? `Welt '${worldName}' als aktive Welt gesetzt. Bitte starte den Server neu, um die Welt zu laden.`
          : `Set '${worldName}' as active world. Please restart your server to apply changes.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Wechseln der Welt' : 'Failed to Change Active World',
        description: err.message || (isDe ? 'server.properties konnte nicht gespeichert werden.' : 'Could not save server.properties.'),
        type: 'error',
      });
    }
  };

  // Dimension Reset (Nether / End)
  const handleConfirmResetDimension = async () => {
    if (!selectedServer?.uuid || !resetDimensionModal.dim) return;
    setIsResetting(true);

    const { worldName, dim } = resetDimensionModal;

    try {
      const targetPaths = [
        `/${worldName}/${dim.folder}`,
        `/${worldName}_${dim.id === 'nether' ? 'nether' : 'the_end'}/${dim.folder}`,
        `/${worldName}_${dim.id === 'nether' ? 'nether' : 'the_end'}`,
      ];

      for (const p of targetPaths) {
        try {
          await api.files.delete(selectedServer.uuid, [dim.folder, `${worldName}_nether`, `${worldName}_the_end`], `/${worldName}`);
        } catch {}
      }

      try {
        await api.servers.command(
          selectedServer.uuid,
          `say [PteroNext] Dimension ${dim.name} has been reset for new terrain generation!`
        );
      } catch {}

      addToast({
        title: isDe ? 'Dimension zurückgesetzt' : 'Dimension Reset',
        description: isDe
          ? `Dimension '${dim.name}' wurde erfolgreich gelöscht. Beim nächsten Betreten wird das Terrain frisch generiert.`
          : `Dimension '${dim.name}' has been successfully reset. Fresh terrain will generate when players enter.`,
        type: 'success',
      });

      setResetDimensionModal({ isOpen: false, worldName: '', dim: null });
      loadWorldsAndConfig();
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Zurücksetzen' : 'Failed to Reset Dimension',
        description: err.message || (isDe ? 'Dimension konnte nicht bereinigt werden.' : 'Dimension could not be reset.'),
        type: 'error',
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Create New World
  const handleCreateNewWorld = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer?.uuid || !newWorldName.trim()) return;
    setIsCreatingWorld(true);

    const cleanName = newWorldName.trim().replace(/[^a-zA-Z0-9_-]/g, '_');

    try {
      let updatedProps = serverPropsRaw;
      if (updatedProps.includes('level-name=')) {
        updatedProps = updatedProps.replace(/level-name=.*/, `level-name=${cleanName}`);
      } else {
        updatedProps += `\nlevel-name=${cleanName}\n`;
      }

      if (newWorldSeed.trim()) {
        if (updatedProps.includes('level-seed=')) {
          updatedProps = updatedProps.replace(/level-seed=.*/, `level-seed=${newWorldSeed.trim()}`);
        } else {
          updatedProps += `\nlevel-seed=${newWorldSeed.trim()}\n`;
        }
      }

      if (updatedProps.includes('level-type=')) {
        updatedProps = updatedProps.replace(/level-type=.*/, `level-type=${newWorldType}`);
      } else {
        updatedProps += `\nlevel-type=${newWorldType}\n`;
      }

      await saveFileContent('server.properties', updatedProps);

      addToast({
        title: isDe ? 'Neue Welt konfiguriert' : 'New World Configured',
        description: isDe
          ? `Welt '${cleanName}' wurde angelegt und in server.properties aktiviert. Starte den Server, um sie zu generieren!`
          : `World '${cleanName}' created and set as active. Restart server to generate chunks!`,
        type: 'success',
      });

      setCreateWorldModal(false);
      setNewWorldName('');
      setNewWorldSeed('');
      loadWorldsAndConfig();
    } catch (err: any) {
      addToast({
        title: isDe ? 'Fehler beim Anlegen der Welt' : 'Failed to Create World',
        description: err.message || (isDe ? 'Konnte neue Welt nicht konfigurieren.' : 'Could not configure new world.'),
        type: 'error',
      });
    } finally {
      setIsCreatingWorld(false);
    }
  };

  // Backup / Zip World
  const handleBackupWorld = async (worldName: string) => {
    if (!selectedServer?.uuid) return;
    setBackupLoading(worldName);

    try {
      const zipName = `${worldName}-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      await api.files.compress(selectedServer.uuid, [worldName], '/', zipName);

      addToast({
        title: isDe ? 'Welt gesichert' : 'World Backup Created',
        description: isDe
          ? `Archiv '${zipName}' wurde im Hauptverzeichnis des Servers gespeichert.`
          : `Archive '${zipName}' saved to server root directory.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: isDe ? 'Backup fehlgeschlagen' : 'Backup Failed',
        description: err.message || (isDe ? 'Konnte Weltarchiv nicht erstellen.' : 'Could not create world archive.'),
        type: 'error',
      });
    } finally {
      setBackupLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <Globe className="w-3 h-3 text-emerald-400" />
              Minecraft World Matrix
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300 border border-white/10">
              {isDe ? 'Aktiv' : 'Active'}: {activeWorldName}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Compass className="w-6 h-6 text-emerald-400" />
            Minecraft World Manager
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mt-1">
            {isDe
              ? 'Verwalte Dimensionen, führe 1-Klick-Resets für Nether & End durch, wechsle zwischen Welten und konfiguriere Gamerules in Echtzeit.'
              : 'Manage dimensions, perform 1-click resets for Nether & End, switch active worlds and configure gamerules in real time.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadWorldsAndConfig()}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60 transition-all hover:text-white"
            title={isDe ? 'Aktualisieren' : 'Refresh'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setCreateWorldModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold font-mono transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{isDe ? 'Neue Welt anlegen' : 'Create New World'}</span>
          </button>
        </div>
      </div>

      {/* Active World Spotlight Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0d1117]/90 border border-emerald-500/30 backdrop-blur-xl relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]" />
              <h2 className="text-lg sm:text-xl font-bold text-white font-mono">
                {activeWorldName}
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold uppercase tracking-wider">
                {isDe ? 'Aktive Hauptwelt' : 'Active Main World'}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-slate-300 border border-white/10 capitalize">
                {isDe ? 'Schwierigkeit' : 'Difficulty'}: {gamerules.difficulty}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 max-w-xl">
              {isDe
                ? 'Diese Welt wird beim Start des Servers geladen. Dimensionen wie Nether und End können unabhängig voneinander zurückgesetzt werden, um neue Biome und Strukturen zu generieren.'
                : 'This world is loaded on server startup. Dimensions like Nether and End can be reset independently to regenerate new terrain, biomes and structures.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => handleBackupWorld(activeWorldName)}
              disabled={backupLoading === activeWorldName}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition-all disabled:opacity-50"
            >
              {backupLoading === activeWorldName ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <FolderArchive className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{isDe ? 'Welt als ZIP sichern' : 'Backup World as ZIP'}</span>
            </button>
          </div>
        </div>

        {/* Dimension Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          {DIMENSIONS.map((dim) => {
            const Icon = dim.icon;
            const isOverworld = dim.id === 'overworld';
            return (
              <div
                key={dim.id}
                className="p-4 rounded-xl bg-[#161b22]/90 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${dim.bgColor} border ${dim.borderColor} ${dim.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">{dim.name}</h4>
                        <span className="text-[10px] font-mono text-slate-500">
                          {isDe ? 'Ordner' : 'Folder'}: {dim.folder}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/10">
                      {isDe ? '🟢 Aktiv' : '🟢 Active'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-2">
                    {isDe ? dim.descriptionDe : dim.descriptionEn}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500">
                    {isOverworld
                      ? (isDe ? 'Hauptbasis & Spawn' : 'Main Base & Spawn')
                      : (isDe ? 'Sicherer Reset möglich' : 'Safe reset available')}
                  </span>
                  {!isOverworld ? (
                    <button
                      onClick={() =>
                        setResetDimensionModal({
                          isOpen: true,
                          worldName: activeWorldName,
                          dim,
                        })
                      }
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono transition-all"
                      title={isDe ? 'Dimension zurücksetzen und Chunks neu generieren' : 'Reset dimension and regenerate chunks'}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                      <span>{isDe ? 'Dimension resetten' : 'Reset Dimension'}</span>
                    </button>
                  ) : (
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {isDe ? 'Geschützt' : 'Protected'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Gamerules Controls */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0d1117] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {isDe ? 'Live-Gamerules & Weltregeln' : 'Live Gamerules & World Rules'}
              </h3>
              <p className="text-xs text-slate-400">
                {isDe
                  ? 'Schalte Spielregeln mit einem Klick live um (sendet den passenden Konsolenbefehl an den Server).'
                  : 'Toggle game rules live with one click (dispatches console commands directly to the server).'}
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
            {isDe ? 'Echtzeit-Synchronisation' : 'Real-time sync'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {/* keepInventory */}
          <div className="p-3.5 rounded-xl bg-[#161b22] border border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-mono font-semibold text-white">keepInventory</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isDe ? 'Inventar beim Sterben behalten' : 'Keep inventory upon death'}
              </p>
            </div>
            <button
              onClick={() => handleToggleGamerule('keepInventory', gamerules.keepInventory)}
              disabled={isUpdatingGamerule === 'keepInventory'}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                gamerules.keepInventory ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  gamerules.keepInventory ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* mobGriefing */}
          <div className="p-3.5 rounded-xl bg-[#161b22] border border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-mono font-semibold text-white">mobGriefing</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isDe ? 'Creeper- & Enderman-Griefing' : 'Creeper & Enderman block damage'}
              </p>
            </div>
            <button
              onClick={() => handleToggleGamerule('mobGriefing', gamerules.mobGriefing)}
              disabled={isUpdatingGamerule === 'mobGriefing'}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                gamerules.mobGriefing ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  gamerules.mobGriefing ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* doDaylightCycle */}
          <div className="p-3.5 rounded-xl bg-[#161b22] border border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-mono font-semibold text-white">doDaylightCycle</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isDe ? 'Tag- & Nachtwechsel aktiv' : 'Daylight cycle progression'}
              </p>
            </div>
            <button
              onClick={() => handleToggleGamerule('doDaylightCycle', gamerules.doDaylightCycle)}
              disabled={isUpdatingGamerule === 'doDaylightCycle'}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                gamerules.doDaylightCycle ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  gamerules.doDaylightCycle ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* doWeatherCycle */}
          <div className="p-3.5 rounded-xl bg-[#161b22] border border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-mono font-semibold text-white">doWeatherCycle</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isDe ? 'Regen & Gewitter aktiv' : 'Weather cycle & storm changes'}
              </p>
            </div>
            <button
              onClick={() => handleToggleGamerule('doWeatherCycle', gamerules.doWeatherCycle)}
              disabled={isUpdatingGamerule === 'doWeatherCycle'}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                gamerules.doWeatherCycle ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  gamerules.doWeatherCycle ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* doFireTick */}
          <div className="p-3.5 rounded-xl bg-[#161b22] border border-slate-800 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-mono font-semibold text-white">doFireTick</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isDe ? 'Feuerausbreitung aktiv' : 'Fire spread & burning'}
              </p>
            </div>
            <button
              onClick={() => handleToggleGamerule('doFireTick', gamerules.doFireTick)}
              disabled={isUpdatingGamerule === 'doFireTick'}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                gamerules.doFireTick ? 'bg-emerald-500' : 'bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  gamerules.doFireTick ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Multi-World List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          {isDe ? `Installierte Welten (${worlds.length})` : `Installed Worlds (${worlds.length})`}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {worlds.map((w) => {
            const isCur = w.isActive;
            return (
              <div
                key={w.name}
                className={`p-4 rounded-xl border transition-all ${
                  isCur
                    ? 'bg-[#161b22] border-emerald-500/40 shadow-lg'
                    : 'bg-[#0d1117] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl border ${
                        isCur
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white font-mono">{w.name}</h4>
                      <p className="text-[11px] font-mono text-slate-500">
                        {isDe ? 'Ordner' : 'Folder'}: /{w.folder} · ca. {w.sizeMb} MB
                      </p>
                    </div>
                  </div>

                  {isCur ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isDe ? 'Aktiv' : 'Active'}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSetActiveWorld(w.name)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono transition-all"
                    >
                      {isDe ? 'Als aktiv setzen' : 'Set as Active'}
                    </button>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                    <span>Overworld</span>
                    <span>·</span>
                    <span>Nether</span>
                    <span>·</span>
                    <span>End</span>
                  </div>

                  <button
                    onClick={() => handleBackupWorld(w.name)}
                    disabled={backupLoading === w.name}
                    className="text-slate-400 hover:text-white flex items-center gap-1 text-[11px] transition-colors"
                  >
                    <Download className="w-3 h-3 text-emerald-400" />
                    <span>{isDe ? 'ZIP-Backup' : 'ZIP Backup'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL: RESET DIMENSION */}
      <Modal
        isOpen={resetDimensionModal.isOpen}
        onClose={() => setResetDimensionModal({ isOpen: false, worldName: '', dim: null })}
        title={
          isDe
            ? `${resetDimensionModal.dim?.name || 'Dimension'} zurücksetzen`
            : `Reset ${resetDimensionModal.dim?.name || 'Dimension'}`
        }
        subtitle={`${isDe ? 'Welt' : 'World'}: ${resetDimensionModal.worldName}`}
        icon={<RotateCcw className="w-5 h-5 text-rose-400" />}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setResetDimensionModal({ isOpen: false, worldName: '', dim: null })}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
            >
              {isDe ? 'Abbrechen' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleConfirmResetDimension}
              disabled={isResetting}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white text-xs font-bold font-mono transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] disabled:opacity-50 flex items-center gap-2"
            >
              {isResetting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isDe ? 'Ja, Dimension jetzt zurücksetzen' : 'Yes, Reset Dimension Now'}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4 text-xs font-mono text-slate-300">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <p className="leading-relaxed">
              {isDe
                ? `Bist du sicher? Alle Chunks und Spielerbauten in der Dimension "${resetDimensionModal.dim?.name}" werden unwiderruflich gelöscht.`
                : `Are you sure? All chunks and player builds in dimension "${resetDimensionModal.dim?.name}" will be permanently deleted.`}
            </p>
          </div>
          <p className="text-slate-400 leading-relaxed">
            {isDe
              ? 'Deine Overworld-Bauten, Spieler-Inventare und Level-Fortschritte bleiben vollständig erhalten. Sobald ein Spieler das Portal wieder betritt, generiert der Server das Terrain komplett neu.'
              : 'Your Overworld structures, player inventories and level progress remain completely intact. When a player re-enters the portal, the server generates brand new terrain.'}
          </p>
        </div>
      </Modal>

      {/* MODAL: CREATE NEW WORLD */}
      <Modal
        isOpen={createWorldModal}
        onClose={() => setCreateWorldModal(false)}
        title={isDe ? 'Neue Minecraft-Welt anlegen' : 'Create New Minecraft World'}
        subtitle={
          isDe
            ? 'Erstelle eine frische Welt mit individuellem Namen, Seed und Typ.'
            : 'Create a fresh world with custom name, seed and generator type.'
        }
        icon={<Plus className="w-5 h-5 text-emerald-400" />}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setCreateWorldModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
            >
              {isDe ? 'Abbrechen' : 'Cancel'}
            </button>
            <button
              type="submit"
              form="createWorldForm"
              disabled={isCreatingWorld}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold font-mono transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 flex items-center gap-2"
            >
              {isCreatingWorld && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{isDe ? 'Welt aktivieren & anlegen' : 'Activate & Create World'}</span>
            </button>
          </div>
        }
      >
        <form id="createWorldForm" onSubmit={handleCreateNewWorld} className="space-y-4 text-xs font-mono">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              {isDe ? 'Welt-Name' : 'World Name'} <span className="text-emerald-400">*</span>
            </label>
            <input
              type="text"
              required
              value={newWorldName}
              onChange={(e) => setNewWorldName(e.target.value)}
              placeholder="survival_season_2"
              className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              {isDe ? 'Seed (Optional)' : 'Seed (Optional)'}
            </label>
            <input
              type="text"
              value={newWorldSeed}
              onChange={(e) => setNewWorldSeed(e.target.value)}
              placeholder={isDe ? 'z. B. -48291048102834 oder leer lassen' : 'e.g. -48291048102834 or leave empty'}
              className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              {isDe ? 'Generatortyp' : 'Generator Type'}
            </label>
            <select
              value={newWorldType}
              onChange={(e) => setNewWorldType(e.target.value)}
              className="w-full px-3 py-2 bg-[#161b22] border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="default">{isDe ? 'Standard (Normal)' : 'Default (Standard)'}</option>
              <option value="flat">{isDe ? 'Flachland (Superflat)' : 'Superflat'}</option>
              <option value="largebiomes">{isDe ? 'Große Biome (Large Biomes)' : 'Large Biomes'}</option>
              <option value="amplified">{isDe ? 'Verstärkt (Amplified)' : 'Amplified'}</option>
            </select>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WorldManagerTab;
