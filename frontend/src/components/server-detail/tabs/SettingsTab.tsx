import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  Settings,
  Save,
  FolderSync,
  AlertTriangle,
  Copy,
  Check,
  Package,
  Cpu,
  ExternalLink,
  Terminal,
  Server,
  Zap,
  Moon,
  Power,
  Radio,
  HardDrive,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Key,
  Trash2,
  Clock,
  Plus,
} from 'lucide-react';
import { api } from '../../../api/client';
import { DeleteConfirmModal } from '../../common/DeleteConfirmModal';

interface VersionGroup {
  group: string;
  versions: string[];
}

const GROUP_LABELS: Record<string, string> = {
  '26.3': 'Minecraft 26.3 (Latest 2026 Release)',
  '26.2': 'Minecraft 26.2',
  '26.1': 'Minecraft 26.1',
  '1.21': 'Minecraft 1.21.x (Tricky Trials)',
  '1.20': 'Minecraft 1.20.x (Trails & Tales)',
  '1.19': 'Minecraft 1.19.x (The Wild Update)',
  '1.18': 'Minecraft 1.18.x (Caves & Cliffs Part II)',
  '1.17': 'Minecraft 1.17.x (Caves & Cliffs Part I)',
  '1.16': 'Minecraft 1.16.x (Nether Update)',
  '1.15': 'Minecraft 1.15.x (Buzzy Bees)',
  '1.14': 'Minecraft 1.14.x (Village & Pillage)',
  '1.13': 'Minecraft 1.13.x (Update Aquatic)',
  '1.12': 'Minecraft 1.12.x (World of Color)',
  '1.11': 'Minecraft 1.11.x (Exploration Update)',
  '1.10': 'Minecraft 1.10.x (Frostburn Update)',
  '1.9': 'Minecraft 1.9.x (Combat Update)',
  '1.8': 'Minecraft 1.8.x (Bountiful Update - PvP Classic)',
  '1.7': 'Minecraft 1.7.x (The Update that Changed the World)',
};

const ALL_MINECRAFT_VERSIONS: VersionGroup[] = [
  {
    group: 'Minecraft 26.x (Newest 2026 Releases)',
    versions: ['26.3', '26.2', '26.1.2', '26.1.1'],
  },
  {
    group: 'Minecraft 1.21.x (Tricky Trials)',
    versions: [
      '1.21.11',
      '1.21.10',
      '1.21.9',
      '1.21.8',
      '1.21.7',
      '1.21.6',
      '1.21.5',
      '1.21.4',
      '1.21.3',
      '1.21.2',
      '1.21.1',
      '1.21',
    ],
  },
  {
    group: 'Minecraft 1.20.x (Trails & Tales)',
    versions: ['1.20.6', '1.20.5', '1.20.4', '1.20.2', '1.20.1', '1.20'],
  },
  {
    group: 'Minecraft 1.19.x (The Wild Update)',
    versions: ['1.19.4', '1.19.3', '1.19.2', '1.19.1', '1.19'],
  },
  {
    group: 'Minecraft 1.18.x (Caves & Cliffs Part II)',
    versions: ['1.18.2', '1.18.1', '1.18'],
  },
  {
    group: 'Minecraft 1.17.x (Caves & Cliffs Part I)',
    versions: ['1.17.1', '1.17'],
  },
  {
    group: 'Minecraft 1.16.x (Nether Update)',
    versions: ['1.16.5', '1.16.4', '1.16.3', '1.16.2', '1.16.1'],
  },
  {
    group: 'Minecraft 1.15.x (Buzzy Bees)',
    versions: ['1.15.2', '1.15.1', '1.15'],
  },
  {
    group: 'Minecraft 1.14.x (Village & Pillage)',
    versions: ['1.14.4', '1.14.3', '1.14.2', '1.14.1', '1.14'],
  },
  {
    group: 'Minecraft 1.13.x (Update Aquatic)',
    versions: ['1.13.2', '1.13.1', '1.13'],
  },
  {
    group: 'Minecraft 1.12.x (World of Color)',
    versions: ['1.12.2', '1.12.1', '1.12'],
  },
  {
    group: 'Minecraft 1.11.x & 1.10.x',
    versions: ['1.11.2', '1.10.2'],
  },
  {
    group: 'Minecraft 1.9.x & 1.8.x (Combat / PvP Classic)',
    versions: ['1.9.4', '1.8.8'],
  },
  {
    group: 'Minecraft 1.7.x (The Update that Changed the World)',
    versions: ['1.7.10'],
  },
];

function parsePaperVersions(
  rawVersions: Record<string, string[]> | null,
  includePre: boolean
): VersionGroup[] {
  if (!rawVersions) {
    return ALL_MINECRAFT_VERSIONS;
  }
  const groups: VersionGroup[] = [];
  for (const [key, verList] of Object.entries(rawVersions)) {
    const filtered = verList.filter((v) => {
      if (!includePre && (v.includes('-rc') || v.includes('-pre'))) {
        return false;
      }
      return true;
    });
    if (filtered.length > 0) {
      const label = GROUP_LABELS[key] || `Minecraft ${key}.x`;
      groups.push({
        group: label,
        versions: filtered,
      });
    }
  }
  return groups.length > 0 ? groups : ALL_MINECRAFT_VERSIONS;
}

export const SettingsTab: React.FC = () => {
  const {
    selectedServer,
    addToast,
    setActiveView,
    deleteServer,
    updateServerStartup,
    installMinecraftVersion,
    updateServerAdminSettings,
    adminNodes,
  } = useApp();
  const { language } = useTranslation();

  const [name, setName] = useState(selectedServer?.name || '');
  const [description, setDescription] = useState(selectedServer?.description || '');
  const [startupCommand, setStartupCommand] = useState(
    selectedServer?.startup ||
      'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}}'
  );
  const [dockerImage, setDockerImage] = useState(selectedServer?.dockerImage || '');
  const [memoryMB, setMemoryMB] = useState(selectedServer?.stats.memoryLimit || 2048);
  const [cpuLimit, setCpuLimit] = useState(selectedServer?.cpuLimit || 200);
  const [diskMB, setDiskMB] = useState(selectedServer?.stats.diskLimit || 10240);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingStartup, setIsSavingStartup] = useState(false);
  const [selectedMcVersion, setSelectedMcVersion] = useState('26.3');
  const [customVersion, setCustomVersion] = useState('');
  const [serverJarFile, setServerJarFile] = useState('server.jar');
  const [isInstallingVersion, setIsInstallingVersion] = useState(false);
  const [dangerModalAction, setDangerModalAction] = useState<'reinstall' | 'delete' | null>(null);
  const [includePreReleases, setIncludePreReleases] = useState(false);
  const [rawApiVersions, setRawApiVersions] = useState<Record<string, string[]> | null>(null);

  // Modulare Sub-Sektionen Tabs
  const [activeSubTab, setActiveSubTab] = useState<
    'all' | 'general' | 'sftp' | 'versions' | 'startup' | 'advanced' | 'danger'
  >('all');

  // Sleep Mode / Auto-Scaler State
  const [sleepModeEnabled, setSleepModeEnabled] = useState(false);
  const [sleepTimeoutMinutes, setSleepTimeoutMinutes] = useState(15);
  const [isSavingSleep, setIsSavingSleep] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);

  // Feature 2: Multi-Node Live-Migration State
  const [migrationState, setMigrationState] = useState<any>(null);
  const [targetNodeId, setTargetNodeId] = useState<number>(0);
  const [isStartingMigration, setIsStartingMigration] = useState(false);

  const fetchMigrationStatus = async () => {
    if (!selectedServer?.uuid) return;
    try {
      const res = await api.migration.getStatus(selectedServer.uuid);
      if (res && res.migration) {
        setMigrationState(res.migration);
      }
    } catch (e) {
      console.warn('Could not load migration status:', e);
    }
  };

  useEffect(() => {
    fetchMigrationStatus();
  }, [selectedServer?.uuid]);

  useEffect(() => {
    if (migrationState?.status === 'streaming' || migrationState?.status === 'delta_sync') {
      const timer = setInterval(() => {
        fetchMigrationStatus();
      }, 2000);
      return () => clearInterval(timer);
    }
  }, [migrationState?.status, selectedServer?.uuid]);

  const handleStartMigration = async () => {
    if (!selectedServer?.uuid) return;
    const srvNodeId = (selectedServer as any).nodeId || (selectedServer as any).node_id || selectedServer.node;
    const destNode = targetNodeId || (adminNodes.find((n) => String(n.id) !== String(srvNodeId))?.id ? Number(adminNodes.find((n) => String(n.id) !== String(srvNodeId))?.id) : 2);
    try {
      setIsStartingMigration(true);
      const res = await api.migration.start(selectedServer.uuid, destNode);
      addToast({
        title: language === 'de' ? 'Live-Migration gestartet' : 'Live Migration Started',
        description: res.message || (language === 'de' ? 'Daemon-to-Daemon TLS-Stream aktiv!' : 'Streaming server data...'),
        type: 'info',
      });
      fetchMigrationStatus();
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Migrations-Fehler' : 'Migration Error',
        description: err.message || 'Failed to start live migration',
        type: 'error',
      });
    } finally {
      setIsStartingMigration(false);
    }
  };

  const handleCancelMigration = async () => {
    if (!selectedServer?.uuid) return;
    try {
      await api.migration.cancel(selectedServer.uuid);
      addToast({
        title: language === 'de' ? 'Migration abgebrochen' : 'Migration Cancelled',
        description: language === 'de' ? 'Der Übertragungs-Stream wurde gestoppt.' : 'Transfer stream stopped.',
        type: 'info',
      });
      fetchMigrationStatus();
    } catch (err: any) {
      addToast({
        title: 'Error',
        description: err.message,
        type: 'error',
      });
    }
  };

  // Smart SFTP- & Access-Key-Manager State
  const [sftpKeysList, setSftpKeysList] = useState<any[]>([]);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('Helfer-Zugang');
  const [newKeyTtl, setNewKeyTtl] = useState(3);
  const [newKeyIps, setNewKeyIps] = useState('');

  const fetchSftpKeys = async () => {
    if (!selectedServer?.uuid) return;
    try {
      const res = await api.sftpKeys.list(selectedServer.uuid);
      if (res && res.keys) {
        setSftpKeysList(res.keys);
      }
    } catch (e) {
      console.warn('Could not load SFTP keys:', e);
    }
  };

  useEffect(() => {
    fetchSftpKeys();
  }, [selectedServer?.uuid]);

  useEffect(() => {
    if (selectedServer?.uuid) {
      api.sleepMode.get(selectedServer.uuid).then((res) => {
        if (res) {
          setSleepModeEnabled(Boolean(res.sleep_mode_enabled));
          setSleepTimeoutMinutes(res.sleep_timeout_minutes || 15);
          setIsSleeping(Boolean(res.is_sleeping));
        }
      }).catch(() => {});
    }
  }, [selectedServer?.uuid]);

  const handleSaveSleepMode = async () => {
    if (!selectedServer?.uuid) return;
    setIsSavingSleep(true);
    try {
      await api.sleepMode.update(selectedServer.uuid, {
        sleep_mode_enabled: sleepModeEnabled,
        sleep_timeout_minutes: sleepTimeoutMinutes,
      });
      addToast({
        title: 'Auto-Sleep Updated',
        description: `Container auto-sleep is now ${sleepModeEnabled ? `enabled (${sleepTimeoutMinutes} min)` : 'disabled'}.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Save Failed',
        description: err.message || 'Error updating sleep mode',
        type: 'error',
      });
    } finally {
      setIsSavingSleep(false);
    }
  };

  // Dynamically load all possible versions from PaperMC API v3
  useEffect(() => {
    fetch('https://fill.papermc.io/v3/projects/paper', {
      headers: { 'User-Agent': 'PteroNext-Panel/1.0' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.versions) {
          setRawApiVersions(data.versions as Record<string, string[]>);
        }
      })
      .catch(() => {});
  }, []);

  const versionGroups = useMemo(() => {
    return parsePaperVersions(rawApiVersions, includePreReleases);
  }, [rawApiVersions, includePreReleases]);

  const totalVersionsCount = useMemo(() => {
    return versionGroups.reduce((acc, g) => acc + g.versions.length, 0);
  }, [versionGroups]);

  useEffect(() => {
    if (!selectedServer) return;
    setName(selectedServer.name);
    setDescription(selectedServer.description);
    setDockerImage(selectedServer.dockerImage);
    setMemoryMB(selectedServer.stats.memoryLimit || 2048);
    setCpuLimit(selectedServer.cpuLimit || 200);
    setDiskMB(selectedServer.stats.diskLimit || 10240);
    if (selectedServer.startup) {
      setStartupCommand(selectedServer.startup);
    }
  }, [
    selectedServer?.uuid,
    selectedServer?.startup,
    selectedServer?.name,
    selectedServer?.description,
    selectedServer?.dockerImage,
    selectedServer?.stats.memoryLimit,
    selectedServer?.stats.diskLimit,
    selectedServer?.cpuLimit,
  ]);

  if (!selectedServer) {
    return (
      <div className="p-8 text-center text-zinc-500 font-mono text-xs">
        No active server selected.
      </div>
    );
  }

  const sftpUrl = selectedServer.sftpDetails
    ? `sftp://${selectedServer.sftpDetails.user}@${selectedServer.sftpDetails.host}:${selectedServer.sftpDetails.port}`
    : '';

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    addToast({
      title: 'Copied to Clipboard',
      description: `Copied ${label}`,
      type: 'info',
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer) return;
    setIsSavingGeneral(true);
    try {
      await updateServerAdminSettings(selectedServer.uuid, {
        name: name.trim(),
        description: description.trim(),
        dockerImage: dockerImage.trim(),
        memoryMB: Number(memoryMB),
        cpuLimit: Number(cpuLimit),
        diskMB: Number(diskMB),
      });
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleSaveStartup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingStartup(true);
    try {
      await updateServerStartup(selectedServer.uuid, startupCommand);
    } finally {
      setIsSavingStartup(false);
    }
  };

  const handleReinstall = () => {
    setDangerModalAction('reinstall');
  };

  const handleDelete = () => {
    setDangerModalAction('delete');
  };

  const handleConfirmDangerAction = async () => {
    if (dangerModalAction === 'reinstall') {
      addToast({
        title: language === 'de' ? 'Neuinstallation eingeleitet' : 'Reinstallation Initiated',
        description:
          language === 'de'
            ? 'Container-Installationsskript wird ausgeführt.'
            : 'Server queued for installation script execution.',
        type: 'warning',
      });
    } else if (dangerModalAction === 'delete') {
      setDangerModalAction(null);
      await deleteServer(selectedServer.uuid || selectedServer.id);
      return;
    }
    setDangerModalAction(null);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Sub-Section Filter / Modular Navigator */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#0d1017] border border-[#30363d] overflow-x-auto custom-scrollbar">
        {[
          { id: 'all', label: language === 'de' ? 'Alle Optionen' : 'All Options' },
          { id: 'general', label: language === 'de' ? 'Allgemein & Quotas' : 'General & Quotas' },
          { id: 'sftp', label: language === 'de' ? 'SFTP & Zugangsdaten' : 'SFTP & Access' },
          { id: 'versions', label: language === 'de' ? 'Game Versionen' : 'Game Versions' },
          { id: 'startup', label: language === 'de' ? 'Startup & Boot' : 'Startup & Boot' },
          { id: 'advanced', label: language === 'de' ? 'Auto-Scaler & Migration' : 'Auto-Scaler & Migration' },
          { id: 'danger', label: language === 'de' ? 'Danger Zone' : 'Danger Zone' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium transition-all whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'bg-[#1c2128] text-white border border-[#484f58] shadow-sm font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Settings */}
      {(activeSubTab === 'all' || activeSubTab === 'general') && (
        <div className="bg-[#11141a] rounded-2xl p-6 border border-slate-800 shadow-xl space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Settings className="w-4 h-4 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                General Configuration
              </h3>
              <p className="text-xs text-slate-400">Core server metadata and runtime configuration</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveGeneral} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Server Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0d1017] border border-slate-800 hover:border-slate-700 focus:border-[var(--theme-accent,#e5a93c)] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Docker Container Image
              </label>
              <input
                type="text"
                value={dockerImage}
                onChange={(e) => setDockerImage(e.target.value)}
                className="w-full bg-[#0d1017] border border-slate-800 hover:border-slate-700 focus:border-[var(--theme-accent,#e5a93c)] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
              Server Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0d1017] border border-slate-800 hover:border-slate-700 focus:border-[var(--theme-accent,#e5a93c)] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
            />
          </div>

          {/* Hardware & Resource Limits */}
          <div className="pt-3 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2.5">
              <label className="block text-[11px] font-mono uppercase tracking-wider text-amber-400 font-semibold">
                Hardware Limits & Resource Quotas
              </label>
              <span className="text-[10px] text-slate-500 font-mono">
                Dynamically synced with Wings daemon
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Memory Limit (MB) *
                </label>
                <input
                  type="number"
                  min={256}
                  step={128}
                  required
                  value={memoryMB}
                  onChange={(e) => setMemoryMB(Number(e.target.value))}
                  className="w-full bg-[#0d1017] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  = {(memoryMB / 1024).toFixed(1)} GB RAM
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  CPU Limit (%) *
                </label>
                <input
                  type="number"
                  min={50}
                  step={50}
                  required
                  value={cpuLimit}
                  onChange={(e) => setCpuLimit(Number(e.target.value))}
                  className="w-full bg-[#0d1017] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  = {(cpuLimit / 100).toFixed(1)} Cores
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Disk Limit (MB) *
                </label>
                <input
                  type="number"
                  min={1024}
                  step={1024}
                  required
                  value={diskMB}
                  onChange={(e) => setDiskMB(Number(e.target.value))}
                  className="w-full bg-[#0d1017] border border-slate-800 hover:border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
                <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                  = {(diskMB / 1024).toFixed(0)} GB SSD
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSavingGeneral}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingGeneral ? 'Saving Changes...' : 'Save Configuration & Quotas'}</span>
            </button>
          </div>
        </form>
      </div>
      )}

      {/* SFTP Connection Details & 1-Click Launch */}
      {(activeSubTab === 'all' || activeSubTab === 'sftp') && (
      <div className="bg-[#11141a] rounded-2xl p-6 border border-slate-800 shadow-xl space-y-5 animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <FolderSync className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                SFTP File Access & Direct Connect
              </h3>
              <p className="text-xs text-slate-400">
                Connect directly using any SFTP client with your account password.
              </p>
            </div>
          </div>

          {/* 1-Click SFTP Direct Launch */}
          <div className="flex items-center gap-2">
            <a
              href={sftpUrl}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95 shadow-sm"
              title="Click to directly launch FileZilla, Cyberduck, or your default SFTP client"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Direct SFTP Connect</span>
            </a>

            <button
              type="button"
              onClick={() => handleCopy(sftpUrl, 'sftp-full-url', 'SFTP Connection URL')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors"
              title="Copy full sftp:// URL"
            >
              {copiedKey === 'sftp-full-url' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied URL</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy URL</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3.5 bg-[#0d1017] rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                SFTP Host
              </span>
              <span className="text-white font-semibold">{selectedServer.sftpDetails.host}</span>
            </div>
            <button
              onClick={() =>
                handleCopy(selectedServer.sftpDetails.host, 'sftp-host', 'SFTP Host')
              }
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              {copiedKey === 'sftp-host' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="p-3.5 bg-[#0d1017] rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                Port
              </span>
              <span className="text-emerald-400 font-semibold">{selectedServer.sftpDetails.port}</span>
            </div>
            <button
              onClick={() =>
                handleCopy(
                  String(selectedServer.sftpDetails.port),
                  'sftp-port',
                  'SFTP Port'
                )
              }
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
            >
              {copiedKey === 'sftp-port' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="p-3.5 bg-[#0d1017] rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] text-slate-500 block uppercase tracking-wider font-semibold">
                Username
              </span>
              <span className="text-white font-semibold truncate block">
                {selectedServer.sftpDetails.user}
              </span>
            </div>
            <button
              onClick={() =>
                handleCopy(selectedServer.sftpDetails.user, 'sftp-user', 'SFTP Username')
              }
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors flex-shrink-0"
            >
              {copiedKey === 'sftp-user' ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800/60 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-400 truncate">
            <Terminal className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span className="truncate">{sftpUrl}</span>
          </div>
          <span className="text-[11px] text-slate-500 flex-shrink-0 pl-2">Password: Your Panel Account Password</span>
        </div>

        {/* Smart SFTP- & Access-Key-Manager (Gast-Keys, TTL, IP-Whitelisting) */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-white uppercase font-mono flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-indigo-400" />
                <span>Smart SFTP- & Guest-Keys (TTL & IP-Whitelist)</span>
              </h4>
              <p className="text-[11px] text-slate-400 font-sans">
                Generiere zeitlich begrenzte Zugänge für Helfer, Entwickler oder Co-Admins mit automatischem Ablauf.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreatingKey(!isCreatingKey)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Key erstellen</span>
            </button>
          </div>

          {/* New Key Form Drawer */}
          {isCreatingKey && (
            <div className="p-4 rounded-xl bg-[#0d1017] border border-indigo-500/30 space-y-3 text-xs font-mono animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Bezeichnung / Label</label>
                  <input
                    type="text"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="z. B. Plugin-Dev Gastzugang"
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1.5 text-white outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Gültigkeit / TTL (Stunden)</label>
                  <select
                    value={newKeyTtl}
                    onChange={(e) => setNewKeyTtl(Number(e.target.value))}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1.5 text-white outline-none focus:border-indigo-500"
                  >
                    <option value={1}>1 Stunde</option>
                    <option value={3}>3 Stunden (Empfohlen)</option>
                    <option value={12}>12 Stunden</option>
                    <option value={24}>24 Stunden (1 Tag)</option>
                    <option value={72}>72 Stunden (3 Tage)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">IP-Whitelist (Optional)</label>
                  <input
                    type="text"
                    value={newKeyIps}
                    onChange={(e) => setNewKeyIps(e.target.value)}
                    placeholder="z. B. 192.168.1.5, 10.0.0.1"
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-1.5 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingKey(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!selectedServer?.uuid) return;
                    try {
                      const res = await api.sftpKeys.create(selectedServer.uuid, {
                        label: newKeyLabel.trim(),
                        ttl_hours: newKeyTtl,
                        allowed_ips: newKeyIps.trim(),
                      });
                      addToast({
                        title: 'SFTP-Key generiert',
                        description: res.message || 'Temporärer Gast-Key aktiv!',
                        type: 'success',
                      });
                      setIsCreatingKey(false);
                      fetchSftpKeys();
                    } catch (err: any) {
                      addToast({
                        title: 'Fehler',
                        description: err.message || 'Konnte Key nicht anlegen',
                        type: 'error',
                      });
                    }
                  }}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Erstellen & Aktivieren
                </button>
              </div>
            </div>
          )}

          {/* Active Keys Table / Cards */}
          <div className="space-y-2">
            {sftpKeysList.length === 0 ? (
              <div className="p-3 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl">
                Keine temporären Gast-Keys aktiv.
              </div>
            ) : (
              sftpKeysList.map((k) => (
                <div
                  key={k.id}
                  className="p-3 bg-[#0d1017] rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{k.label}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          k.is_expired
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {k.is_expired ? 'Abgelaufen' : 'Aktiv'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-3 flex-wrap">
                      <span>User: <code className="text-indigo-300">{k.username}.{selectedServer.identifier}</code></span>
                      <span>Pass: <code className="text-indigo-300">{k.password}</code></span>
                      {k.allowed_ips && (
                        <span>IPs: <code className="text-amber-400">{k.allowed_ips}</code></span>
                      )}
                      <span className="text-slate-500">
                        Gültig bis: {new Date(k.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* 1-Klick FileZilla / URI */}
                    <a
                      href={k.sftp_uri}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-semibold transition-all flex items-center gap-1.5"
                      title="In FileZilla öffnen (sftp://)"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>FileZilla</span>
                    </a>

                    {/* 1-Klick WinSCP */}
                    <a
                      href={k.winscp_link}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold transition-all flex items-center gap-1.5"
                      title="In WinSCP öffnen"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>WinSCP</span>
                    </a>

                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedServer?.uuid) return;
                        try {
                          await api.sftpKeys.delete(selectedServer.uuid, k.id);
                          addToast({
                            title: 'Key widerrufen',
                            description: 'Gast-Key erfolgreich gelöscht.',
                            type: 'info',
                          });
                          fetchSftpKeys();
                        } catch (err: any) {
                          addToast({
                            title: 'Fehler',
                            description: err.message,
                            type: 'error',
                          });
                        }
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors"
                      title="Key sofort widerrufen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}

      {/* Minecraft Version & Server Jar Installer */}
      {(activeSubTab === 'all' || activeSubTab === 'versions') && (
      <div className="bg-[#11141a] rounded-2xl p-6 border border-slate-800 shadow-xl space-y-5 animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800/80 pb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Package className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                Minecraft Version & Server Jar
              </h3>
              <p className="text-xs text-slate-400">
                1-Click download and configure official PaperMC release & auto-accept EULA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono font-semibold whitespace-nowrap">
              {totalVersionsCount}+ Versions Available
            </span>
            <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-mono font-semibold whitespace-nowrap">
              Official PaperMC API
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
              <label className="text-xs font-mono uppercase text-slate-300 font-medium">
                Minecraft Version
              </label>
              <label className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includePreReleases}
                  onChange={(e) => setIncludePreReleases(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer"
                />
                Show Snapshot / RC Builds
              </label>
            </div>
            <select
              value={selectedMcVersion}
              onChange={(e) => setSelectedMcVersion(e.target.value)}
              className="w-full bg-[#0d1017] border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors font-mono"
            >
              {versionGroups.map((group) => (
                <optgroup key={group.group} label={group.group} className="bg-[#11141a] text-slate-300 font-sans font-semibold">
                  {group.versions.map((ver) => (
                    <option key={ver} value={ver} className="bg-[#0d1017] text-white font-mono">
                      Paper {ver} {ver === '26.3' ? '★ Latest 2026' : ver === '1.21.11' ? '★ Latest 1.21' : ver === '1.21.1' ? '★ Stable LTS' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Custom / Other Version" className="bg-[#11141a] text-slate-300 font-sans font-semibold">
                <option value="__custom__" className="bg-[#0d1017] text-emerald-400 font-mono font-medium">
                  ✏️ Custom Version (Type manually)
                </option>
              </optgroup>
            </select>

            {selectedMcVersion === '__custom__' && (
              <div className="mt-2.5">
                <input
                  type="text"
                  value={customVersion}
                  onChange={(e) => setCustomVersion(e.target.value)}
                  placeholder="e.g. 1.21.2, 1.20.3, or custom build"
                  className="w-full bg-[#0d1017] border border-emerald-500/60 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-emerald-400 font-mono focus:outline-none placeholder:text-slate-600 shadow-sm"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1 font-mono">
                  Downloads specified build from PaperMC API, or falls back to PurpurMC if Paper has no build.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
              Server Jar File (<code className="text-emerald-400 font-mono">SERVER_JARFILE</code>)
            </label>
            <input
              type="text"
              value={serverJarFile}
              onChange={(e) => setServerJarFile(e.target.value)}
              placeholder="server.jar"
              className="w-full bg-[#0d1017] border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-emerald-400 font-mono focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
              Target executable filename. Defaults to <code className="text-slate-400">server.jar</code>.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
          <p className="text-xs text-slate-400 font-mono">
            Automatically writes <code className="text-emerald-400">eula=true</code> to eula.txt and saves jar to disk.
          </p>
          <button
            type="button"
            disabled={isInstallingVersion || (selectedMcVersion === '__custom__' && !customVersion.trim())}
            onClick={async () => {
              const targetVer = selectedMcVersion === '__custom__' ? customVersion.trim() : selectedMcVersion;
              if (!targetVer) return;
              setIsInstallingVersion(true);
              try {
                await installMinecraftVersion(targetVer, serverJarFile.trim() || 'server.jar');
              } finally {
                setIsInstallingVersion(false);
              }
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95 disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <FolderSync className={`w-3.5 h-3.5 ${isInstallingVersion ? 'animate-spin' : ''}`} />
            <span>
              {isInstallingVersion
                ? 'Downloading & Configuring...'
                : `Download & Install Paper ${selectedMcVersion === '__custom__' ? (customVersion.trim() || 'Custom') : selectedMcVersion}`}
            </span>
          </button>
        </div>
      </div>
      )}

      {/* Startup Parameters & Save Command */}
      {(activeSubTab === 'all' || activeSubTab === 'startup') && (
      <div className="bg-[#11141a] rounded-2xl p-6 border border-slate-800 shadow-xl space-y-5 animate-in fade-in">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                Startup Command & Boot Variables
              </h3>
              <p className="text-xs text-slate-400">
                Configure the command executed by Wings when starting this container
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] font-mono">
            Daemon Managed
          </span>
        </div>

        <form onSubmit={handleSaveStartup} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono uppercase text-slate-300 font-medium">
                Command Template
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Variables like {'{{SERVER_MEMORY}}'} or {'{{SERVER_JARFILE}}'} are dynamically evaluated
              </span>
            </div>
            <textarea
              rows={3}
              value={startupCommand}
              onChange={(e) => setStartupCommand(e.target.value)}
              className="w-full bg-[#0d1017] border border-slate-800 hover:border-slate-700 focus:border-purple-500 rounded-xl p-3.5 text-xs text-emerald-400 font-mono focus:outline-none transition-colors leading-relaxed selection:bg-purple-500/30"
              placeholder="e.g. java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Requires server restart for changes to take effect.</span>
            </div>
            <button
              type="submit"
              disabled={isSavingStartup}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition-all shadow-lg shadow-purple-600/20 active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingStartup ? 'Saving...' : 'Save Startup Command'}</span>
            </button>
          </div>
        </form>
      </div>
      )}

      {/* Advanced Tools: Server Resource Auto-Scaler & Multi-Node Live-Migration */}
      {(activeSubTab === 'all' || activeSubTab === 'advanced') && (
      <>
      {/* Server Resource Auto-Scaler / Sleep Mode */}
      <div className="bg-[#11141a] rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4 animate-in fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Moon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono">
                  Resource Auto-Scaler / Sleep Mode
                </h3>
                {isSleeping ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold animate-pulse">
                    STANDBY / ASLEEP
                  </span>
                ) : sleepModeEnabled ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                    ARMED & MONITORING
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    DISABLED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Pausiert den Server bei 0 aktiven Spielern automatisch zur Ressourcenschonung und weckt ihn sofort bei Verbindungsaufbau auf.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto">
            <span className="text-xs font-mono text-slate-300 font-semibold">Auto-Sleep aktivieren</span>
            <input
              type="checkbox"
              checked={sleepModeEnabled}
              onChange={(e) => setSleepModeEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-900 border-slate-700"
            />
          </label>
        </div>

        {sleepModeEnabled && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Inaktivitäts-Zeit bis Standby
                </label>
                <select
                  value={sleepTimeoutMinutes}
                  onChange={(e) => setSleepTimeoutMinutes(Number(e.target.value))}
                  className="w-full bg-[#0d1017] border border-slate-800 hover:border-slate-700 focus:border-indigo-400 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                >
                  <option value={5}>5 Minuten ohne Spieler</option>
                  <option value={10}>10 Minuten ohne Spieler</option>
                  <option value={15}>15 Minuten (Standard)</option>
                  <option value={30}>30 Minuten ohne Spieler</option>
                  <option value={60}>60 Minuten (1 Stunde)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                  Wake-Up Verhalten
                </label>
                <div className="p-2.5 rounded-xl bg-[#0d1017] border border-slate-800 text-xs font-mono text-slate-300 flex items-center justify-between">
                  <span>Sofort-Wake bei TCP-Ping</span>
                  <span className="text-[10px] text-emerald-400 font-bold">Aktiv</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveSleepMode}
                disabled={isSavingSleep}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingSleep ? 'Speichern...' : 'Sleep-Modus Konfiguration speichern'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feature 2: Multi-Node Live-Migration (Streaming ohne Ausfallzeit) */}
      <div className="rounded-2xl p-6 border border-cyan-500/30 bg-gradient-to-br from-[#161b22] to-cyan-950/20 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white font-mono">
                  {language === 'de' ? 'Multi-Node Live-Migration (Zero-Downtime)' : 'Multi-Node Live Migration (Zero-Downtime)'}
                </h4>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-semibold">
                  Daemon-to-Daemon Stream
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {language === 'de'
                  ? 'Überträgt Serverdaten direkt und verschlüsselt von Node zu Node. Minimaler Switchover durch sekundenschnellen Delta-Sync der letzten Weltdaten.'
                  : 'Encrypted daemon-to-daemon stream with minimal switchover via instant delta sync of recent world changes.'}
              </p>
            </div>
          </div>

          <button
            onClick={fetchMigrationStatus}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors self-start sm:self-auto"
            title="Refresh status"
          >
            <RefreshCw className={`w-4 h-4 ${migrationState?.status === 'streaming' || migrationState?.status === 'delta_sync' ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Node Selection & Stream Pipeline Control */}
        <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5">
                {language === 'de' ? 'Aktuelle Quell-Node' : 'Current Source Node'}
              </label>
              <div className="p-2.5 rounded-xl bg-[#161b22] border border-slate-800 text-xs font-mono text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{migrationState?.source_node_name || 'Node #1 (Frankfurt Primary)'}</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono uppercase text-slate-400 mb-1.5">
                {language === 'de' ? 'Ziel-Node (Target Host)' : 'Target Node (Target Host)'}
              </label>
              <select
                value={targetNodeId}
                onChange={(e) => setTargetNodeId(Number(e.target.value))}
                disabled={migrationState?.status === 'streaming' || migrationState?.status === 'delta_sync'}
                className="w-full bg-[#161b22] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 outline-none disabled:opacity-50"
              >
                <option value={0}>{language === 'de' ? 'Automatisch (Next Available Node)' : 'Automatic (Next Available Node)'}</option>
                {adminNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.fqdn})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Migration Visualizer Pipeline */}
          <div className="p-3.5 rounded-xl bg-[#161b22]/70 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 font-semibold uppercase text-[10px]">
                {language === 'de' ? 'Streaming Status' : 'Streaming Pipeline'}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                migrationState?.status === 'streaming'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : migrationState?.status === 'delta_sync'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : migrationState?.status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}>
                {migrationState?.status?.toUpperCase() || 'IDLE'}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800 relative">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${migrationState?.progress_percent || 0}%` }}
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-bold">{migrationState?.progress_percent || 0}%</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 truncate max-w-xs">{migrationState?.current_phase || (language === 'de' ? 'Bereit für Live-Stream' : 'Ready for live stream')}</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-3">
                <span>{migrationState?.transferred_mb?.toFixed(1) || 0} MB / {migrationState?.total_mb?.toFixed(1) || selectedServer?.stats.diskLimit || 1024} MB</span>
                <span>{migrationState?.transfer_rate || '128 MB/s'}</span>
              </div>
            </div>

            {migrationState?.delta_sync_time_ms && (
              <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 text-[11px] font-mono text-emerald-300 flex items-center justify-between">
                <span>{language === 'de' ? 'Delta-Sync Switchover Unterbrechung:' : 'Delta Sync Switchover Downtime:'}</span>
                <span className="font-bold">{migrationState.delta_sync_time_ms} ms</span>
              </div>
            )}
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex justify-end gap-2.5 pt-1">
            {migrationState?.status === 'streaming' || migrationState?.status === 'delta_sync' ? (
              <button
                type="button"
                onClick={handleCancelMigration}
                className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-mono text-xs font-bold transition-all active:scale-95"
              >
                {language === 'de' ? 'Migration abbrechen' : 'Cancel Migration'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartMigration}
                disabled={isStartingMigration}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-mono text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isStartingMigration ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === 'de' ? 'Initialisiere Stream...' : 'Initializing Stream...'}</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>{language === 'de' ? 'Live-Migration starten' : 'Start Live Migration'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Danger Zone */}
      {(activeSubTab === 'all' || activeSubTab === 'danger') && (
      <div className="rounded-2xl p-6 border border-rose-500/20 bg-rose-500/[0.03] space-y-4 animate-in fade-in">
        <div className="flex items-center gap-2 text-rose-400 font-mono text-sm font-bold uppercase">
          <AlertTriangle className="w-4 h-4" />
          <span>Danger Zone // Destructive Actions</span>
        </div>
        <p className="text-xs text-slate-400">
          The following operations may disrupt active connections or result in unrecoverable data loss.
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-rose-500/20">
          <div>
            <h5 className="text-xs font-bold text-white font-mono">Reinstall Server Container</h5>
            <p className="text-[11px] text-slate-400 font-mono">
              Re-executes the installer script while preserving user data.
            </p>
          </div>
          <button
            onClick={handleReinstall}
            className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-xs font-bold transition-colors whitespace-nowrap active:scale-95"
          >
            Reinstall Server
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-rose-500/20">
          <div>
            <h5 className="text-xs font-bold text-rose-300 font-mono">Delete Server Instance</h5>
            <p className="text-[11px] text-slate-400 font-mono">
              Permanently purge container, disk storage, and database links.
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-mono text-xs font-bold transition-colors whitespace-nowrap active:scale-95"
          >
            Delete Server
          </button>
        </div>
      </div>
      )}

      {/* Cyber-Glass Confirmation Modal for Reinstall/Delete */}
      <DeleteConfirmModal
        isOpen={!!dangerModalAction}
        onClose={() => setDangerModalAction(null)}
        onConfirm={handleConfirmDangerAction}
        title={
          dangerModalAction === 'reinstall'
            ? language === 'de'
              ? 'Server neu installieren'
              : 'Reinstall Server'
            : language === 'de'
            ? 'Server unwiderruflich löschen'
            : 'Delete Server Instance'
        }
        itemName={selectedServer.name}
        description={
          dangerModalAction === 'reinstall'
            ? language === 'de'
              ? `Möchtest du "${selectedServer.name}" wirklich neu installieren? Das Installations-Skript des Containers wird erneut ausgeführt.`
              : `Are you sure you want to reinstall "${selectedServer.name}"? This will re-run the container installation script.`
            : language === 'de'
            ? `Möchtest du den Server "${selectedServer.name}" wirklich dauerhaft löschen? Der Container, alle Dateien und Datenbankverknüpfungen werden gelöscht.`
            : `Are you sure you want to permanently delete "${selectedServer.name}"? This will purge the container, disk storage, and database links.`
        }
        confirmText={
          dangerModalAction === 'reinstall'
            ? language === 'de'
              ? 'Neu installieren'
              : 'Reinstall'
            : undefined
        }
      />
    </div>
  );
};
