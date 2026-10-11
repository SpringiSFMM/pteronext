import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { api } from '../../api/client';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import {
  ArrowLeft,
  Play,
  RotateCw,
  Square,
  Skull,
  Globe,
  Copy,
  Check,
  Clock,
  Shield,
  ShieldAlert,
  Users,
  Radio,
  Lock,
  Unlock,
  AlertOctagon,
  Layers,
  GitFork,
  ExternalLink,
} from 'lucide-react';

interface ActiveAdmin {
  user_id: number;
  username: string;
  avatar?: string;
  activity?: string;
  last_seen: string;
}

export const ServerDetailHeader: React.FC = () => {
  const {
    selectedServer,
    activeServerTab,
    navigateBackFromServer,
    handlePowerAction,
    addToast,
    currentUser,
  } = useApp();

  const { t, language } = useTranslation();

  const [copied, setCopied] = useState(false);
  const [isPresenceOpen, setIsPresenceOpen] = useState(false);
  const presenceRef = useRef<HTMLDivElement>(null);

  // Multi-User Co-Pilot & Incident Freeze Mode
  const [presenceList, setPresenceList] = useState<ActiveAdmin[]>([]);
  const [isFrozen, setIsFrozen] = useState(false);
  const [freezeReason, setFreezeReason] = useState('');
  const [togglingFreeze, setTogglingFreeze] = useState(false);

  // Instant Server-Klon / 1-Klick-Staging State
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneDescription, setCloneDescription] = useState('');
  const [cloneStartImmediately, setCloneStartImmediately] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  const handleExecuteClone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer?.uuid || !cloneName.trim()) return;
    try {
      setIsCloning(true);
      const res = await api.servers.clone(selectedServer.uuid, {
        name: cloneName.trim(),
        description: cloneDescription.trim(),
        start_on_completion: cloneStartImmediately,
      });
      addToast({
        title: language === 'de' ? 'Staging-Server erstellt' : 'Staging Server Created',
        description: res.message || (language === 'de' ? 'Server erfolgreich dupliziert!' : 'Server duplicated successfully!'),
        type: 'success',
      });
      setIsCloneModalOpen(false);
      if (navigateBackFromServer) {
        navigateBackFromServer();
      }
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Klonen fehlgeschlagen' : 'Clone Failed',
        description: err.message || 'Error duplicating server',
        type: 'error',
      });
    } finally {
      setIsCloning(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (presenceRef.current && !presenceRef.current.contains(e.target as Node)) {
        setIsPresenceOpen(false);
      }
    };
    if (isPresenceOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isPresenceOpen]);

  useEffect(() => {
    if (!selectedServer?.uuid) return;

    // Check incident freeze status
    const checkIncidentStatus = async () => {
      try {
        const res = await api.incident.getStatus(selectedServer.uuid);
        if (res) {
          setIsFrozen(res.is_frozen || false);
          setFreezeReason(res.freeze_reason || '');
        }
      } catch (e) {
        // quiet ignore
      }
    };

    // Presence announce & query
    const syncPresence = async () => {
      try {
        const activityStr = `Viewing ${activeServerTab || 'Overview'}`;
        await api.incident.postPresence(selectedServer.uuid, activityStr);
        const pres = await api.incident.getPresence(selectedServer.uuid);
        if (pres?.data) {
          setPresenceList(pres.data);
        }
      } catch (e) {
        // quiet ignore
      }
    };

    checkIncidentStatus();
    syncPresence();

    const interval = setInterval(() => {
      checkIncidentStatus();
      syncPresence();
    }, 8000);

    return () => clearInterval(interval);
  }, [selectedServer?.uuid, activeServerTab]);

  if (!selectedServer) return null;

  const effectiveAdmins =
    presenceList.length > 0
      ? presenceList
      : currentUser
      ? [
          {
            user_id: currentUser.id || 1,
            username: currentUser.username,
            activity: `Viewing ${activeServerTab || 'Overview'}`,
            last_seen: new Date().toISOString(),
          },
        ]
      : [];

  const handleCopyIp = () => {
    navigator.clipboard?.writeText(selectedServer.allocation);
    setCopied(true);
    addToast({
      title: 'Allocation Copied',
      description: `Copied ${selectedServer.allocation} to clipboard`,
      type: 'info',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFreeze = async () => {
    if (!selectedServer?.uuid) return;
    const targetFreeze = !isFrozen;
    const reason = targetFreeze
      ? prompt('Grund für Incident-Modus / Server Freeze (z.B. Exploit-Untersuchung, Chunk-Corruption):', 'Investigation in progress') || 'Admin investigation'
      : '';

    try {
      setTogglingFreeze(true);
      const res = await api.incident.toggleFreeze(selectedServer.uuid, {
        freeze: targetFreeze,
        reason,
      });
      setIsFrozen(res.is_frozen);
      setFreezeReason(res.freeze_reason || '');
      addToast({
        title: targetFreeze ? '🚨 INCIDENT-MODUS AKTIV' : '🛡️ Server entsperrt',
        description: targetFreeze
          ? 'Netzwerkports nach außen gesperrt, Whitelist erzwungen.'
          : 'Server-Isolation aufgehoben. Normaler Spielbetrieb.',
        type: targetFreeze ? 'warning' : 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Aktion fehlgeschlagen',
        description: err.message || 'Konnte Freeze-Status nicht ändern',
        type: 'error',
      });
    } finally {
      setTogglingFreeze(false);
    }
  };

  const isRunning = selectedServer.status === 'running';
  const isStarting = selectedServer.status === 'starting';
  const isStopping = selectedServer.status === 'stopping';
  const isOffline = selectedServer.status === 'offline' || selectedServer.status === 'stopped' || !selectedServer.status;

  const formatUptime = (seconds: number) => {
    if (seconds === 0) return 'Offline';
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-3">
      {/* Incident Safe Mode Banner if active */}
      {isFrozen && (
        <div className="bg-rose-950/60 border border-rose-500/50 rounded-xl p-3.5 flex items-center justify-between gap-3 text-rose-200 animate-pulse shadow-[0_0_25px_rgba(244,63,94,0.15)]">
          <div className="flex items-center gap-2.5">
            <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-xs uppercase tracking-wider block text-white font-mono">
                INCIDENT ISOLATION / SAFE MODE AKTIV
              </span>
              <p className="text-[11px] text-rose-300 font-mono">
                Ports gesperrt · Whitelist erzwungen · Grund: <span className="underline">{freezeReason || 'Sicherheitsprüfung'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleFreeze}
            disabled={togglingFreeze}
            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-mono font-bold transition-colors shrink-0 shadow"
          >
            Aufheben
          </button>
        </div>
      )}

      {/* Main Header Container */}
      <div className="bg-[#161b22] rounded-xl p-4 sm:p-5 border border-[#30363d] space-y-4 shadow-sm">
        {/* Top bar: Back button, Multi-User Co-Pilot Presence, & Status */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => navigateBackFromServer()}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Back</span>
          </button>

          {/* Multi-User Presence Co-Pilot: named admins + expandable list */}
          <div className="flex items-center gap-3">
            {effectiveAdmins.length > 0 && (
              <div className="relative" ref={presenceRef}>
                <button
                  onClick={() => setIsPresenceOpen((v) => !v)}
                  className="flex items-center gap-2 bg-[#0d1117] px-2.5 py-1.5 rounded-lg border border-[#30363d] hover:border-[var(--theme-accent)] text-xs font-mono transition-colors"
                  aria-expanded={isPresenceOpen}
                  title="Klicken für Online-Admin-Liste"
                >
                  <span className="relative flex w-2 h-2 shrink-0">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
                  </span>
                  <span className="text-slate-400 text-[11px]">Co-Pilot:</span>
                  <span className="text-slate-100 text-[11px] font-semibold max-w-[220px] truncate">
                    {effectiveAdmins.slice(0, 3).map((a) => a.username).join(', ')}
                    {effectiveAdmins.length > 3 && ` +${effectiveAdmins.length - 3}`}
                  </span>
                  <span className="text-[10px] text-emerald-400">
                    ({effectiveAdmins.length} {language === 'de' ? 'online' : 'online'})
                  </span>
                </button>

                <div
                  className={`absolute right-0 top-full mt-2 w-72 z-40 origin-top-right rounded-xl border border-[#30363d] bg-[#161b22]/95 backdrop-blur shadow-2xl transition-all duration-200 ease-out ${
                    isPresenceOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
                  }`}
                >
                  <div className="px-3 py-2 border-b border-[#30363d] text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>{language === 'de' ? 'Online Admins' : 'Online Admins'}</span>
                    <span className="text-emerald-400 font-bold">{effectiveAdmins.length} aktiv</span>
                  </div>
                  <ul className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
                    {effectiveAdmins.map((admin) => {
                      const secs = Math.max(0, Math.round((Date.now() - new Date(admin.last_seen).getTime()) / 1000));
                      return (
                        <li key={admin.user_id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.04]">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 overflow-hidden border border-white/10"
                            style={{ backgroundColor: 'var(--theme-accent)' }}
                          >
                            {(admin as any).avatar || (admin.username === currentUser?.username && currentUser?.avatar) ? (
                              <img
                                src={(admin as any).avatar || currentUser?.avatar}
                                alt={admin.username}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              admin.username.slice(0, 1).toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-white truncate">{admin.username}</div>
                            <div className="text-[10px] font-mono text-slate-400 truncate">
                              {admin.activity || (language === 'de' ? 'Aktiv' : 'Active')}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                            {secs < 10 ? (language === 'de' ? 'jetzt' : 'now') : `${secs}s`}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            <StatusBadge status={(selectedServer.isSuspended || selectedServer.suspended) ? 'suspended' : selectedServer.status} size="md" />
          </div>
        </div>

        {/* Main Server Title & Power Actions + Freeze Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#21262d] text-slate-300 border border-[#30363d] uppercase">
                {selectedServer.egg}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {selectedServer.node} ({selectedServer.nodeLocation})
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {selectedServer.name}
            </h1>

            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {/* IP allocation copy */}
              <button
                onClick={handleCopyIp}
                className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-[#0d1117] px-2.5 py-1 rounded-lg border border-[#30363d] hover:border-[#484f58] hover:text-white transition-all"
              >
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>{selectedServer.allocation}</span>
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-slate-500" />
                )}
              </button>

              {/* Uptime pill */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-[#0d1117] px-2.5 py-1 rounded-lg border border-[#30363d]">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Uptime: {formatUptime(selectedServer.stats.uptime)}</span>
              </div>
            </div>
          </div>

          {/* Power Actions & Safe Mode Button */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1-Click Freeze / Safe Mode Toggle */}
            <button
              onClick={handleToggleFreeze}
              disabled={togglingFreeze}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono font-medium transition-colors ${
                isFrozen
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-[#21262d] hover:bg-slate-700 text-slate-300 hover:text-white border-[#30363d]'
              }`}
              title="Isolates server to investigate exploits or corruption safely"
            >
              {isFrozen ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-rose-400" />
                  <span>Frozen</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>Safe Mode</span>
                </>
              )}
            </button>

            {/* Staging / Clone Action Button */}
            <button
              onClick={() => {
                setCloneName(`${selectedServer.name} (Staging)`);
                setCloneDescription(`Isoliertes Test-Duplikat von ${selectedServer.name}`);
                setCloneStartImmediately(false);
                setIsCloneModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-semibold transition-all shadow-sm active:scale-95"
              title="Instant Server-Klon / 1-Klick-Staging"
            >
              <GitFork className="w-3.5 h-3.5 text-indigo-400" />
              <span>{language === 'de' ? 'Klonen (Staging)' : 'Clone (Staging)'}</span>
            </button>

            {(selectedServer.suspended || selectedServer.isSuspended) ? (
              <span className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-mono font-bold shadow-sm">
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>{language === 'de' ? 'Suspendiert (Gesperrt)' : 'Suspended (Locked)'}</span>
              </span>
            ) : (
              <>
                {isOffline && (
                  <button
                    onClick={() => handlePowerAction(selectedServer.id, 'start')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t('power_start')}</span>
                  </button>
                )}

                {(isRunning || isStarting || isStopping) && (
                  <>
                    <button
                      onClick={() => handlePowerAction(selectedServer.id, 'restart')}
                      disabled={isStopping}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-amber-500/20 text-amber-400 border border-[#30363d] hover:border-amber-500/30 text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isStarting ? 'animate-spin' : ''}`} />
                      <span>{t('power_restart')}</span>
                    </button>

                    <button
                      onClick={() => handlePowerAction(selectedServer.id, 'stop')}
                      disabled={isStopping}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-slate-700 text-slate-300 hover:text-white border border-[#30363d] text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>{t('power_stop')}</span>
                    </button>

                    <button
                      onClick={() => handlePowerAction(selectedServer.id, 'kill')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-rose-500/20 text-rose-400 border border-[#30363d] hover:border-rose-500/30 text-xs font-medium transition-colors"
                      title="Force Kill (SIGKILL)"
                    >
                      <Skull className="w-3.5 h-3.5" />
                      <span>{t('power_kill')}</span>
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mini telemetry quick strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-[#30363d]/80 text-xs font-mono">
          <div className="p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <span className="text-slate-500 block text-[10px] uppercase">CPU Load</span>
            <span className="text-slate-200 font-semibold text-sm">
              {selectedServer.stats.cpu}%
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <span className="text-slate-500 block text-[10px] uppercase">Memory</span>
            <span className="text-slate-200 font-semibold text-sm">
              {(selectedServer.stats.memory / 1024).toFixed(1)} /{' '}
              {(selectedServer.stats.memoryLimit / 1024).toFixed(0)} GB
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <span className="text-slate-500 block text-[10px] uppercase">Disk</span>
            <span className="text-slate-200 font-semibold text-sm">
              {(selectedServer.stats.disk / 1024).toFixed(1)} /{' '}
              {(selectedServer.stats.diskLimit / 1024).toFixed(0)} GB
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <span className="text-slate-500 block text-[10px] uppercase">Network Rx / Tx</span>
            <span className="text-slate-200 font-semibold text-sm">
              {selectedServer.stats.networkRx} / {selectedServer.stats.networkTx} KB/s
            </span>
          </div>
        </div>
      </div>

      {/* 5. Instant Server-Klon / 1-Klick-Staging Modal */}
      <Modal
        isOpen={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
        title={language === 'de' ? 'Instant Server-Klon / 1-Klick-Staging' : 'Instant Server Clone / 1-Click Staging'}
      >
        <form onSubmit={handleExecuteClone} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-mono flex items-start gap-3">
            <GitFork className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-0.5">
                {language === 'de' ? 'Isolierter Test-Server (Staging)' : 'Isolated Test Server (Staging)'}
              </p>
              <p className="text-slate-300">
                {language === 'de'
                  ? 'Dupliziert sämtliche Konfigurationsdateien, Plugins und Daten des Containers. Weist automatisch freie Ports zu, damit risikoreiche Updates sicher getestet werden können.'
                  : 'Duplicates container configs, plugins, and data. Automatically allocates free ports so risky updates can be safely tested.'}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              {language === 'de' ? 'Name des Staging-Servers' : 'Staging Server Name'}
            </label>
            <input
              type="text"
              required
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
              placeholder="z. B. Survival (Staging)"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              {language === 'de' ? 'Beschreibung' : 'Description'}
            </label>
            <textarea
              rows={2}
              value={cloneDescription}
              onChange={(e) => setCloneDescription(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white font-mono outline-none resize-none"
              placeholder="Testumgebung für 1.21 Update..."
            />
          </div>

          <label className="flex items-center gap-3 p-3 rounded-xl bg-[#0d1117] border border-[#30363d] cursor-pointer hover:border-slate-600 transition-colors">
            <input
              type="checkbox"
              checked={cloneStartImmediately}
              onChange={(e) => setCloneStartImmediately(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 border-slate-700 bg-slate-900 focus:ring-0"
            />
            <div className="text-xs font-mono">
              <span className="font-bold text-white block">
                {language === 'de' ? 'Instanz nach Erstellung sofort starten' : 'Start instance immediately after creation'}
              </span>
              <span className="text-slate-400 text-[11px]">
                {language === 'de'
                  ? 'Startet den duplizierten Testserver direkt im Hintergrund'
                  : 'Boots up the cloned staging server automatically'}
              </span>
            </div>
          </label>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#30363d]">
            <button
              type="button"
              onClick={() => setIsCloneModalOpen(false)}
              className="px-3.5 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-300 text-xs font-mono font-medium transition-colors"
            >
              {language === 'de' ? 'Abbrechen' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isCloning}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-mono font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50"
            >
              {isCloning ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{language === 'de' ? 'Dupliziere Server...' : 'Duplicating Server...'}</span>
                </>
              ) : (
                <>
                  <GitFork className="w-3.5 h-3.5" />
                  <span>{language === 'de' ? 'Jetzt Klonen & Staging starten' : 'Clone & Create Staging'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
