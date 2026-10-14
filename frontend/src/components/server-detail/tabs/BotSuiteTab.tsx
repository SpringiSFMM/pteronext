import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import {
  Bot,
  ShieldCheck,
  ShieldAlert,
  Terminal,
  Play,
  RotateCw,
  Package,
  Flame,
  CheckCircle2,
  Clock,
  Zap,
  Cpu,
  Code2,
  AlertTriangle,
  RefreshCw,
  Layers,
  Sparkles,
} from 'lucide-react';

export const BotSuiteTab: React.FC = () => {
  const { selectedServer, addToast, handlePowerAction } = useApp();
  const { language } = useTranslation();
  const isDe = language === 'de';

  const [activeTab, setActiveTab] = useState<'shield' | 'deps' | 'intents'>('shield');

  // Crash-Loop & Shield State
  const [shieldActive, setShieldActive] = useState(true);
  const [crashCount, setCrashCount] = useState(0);
  const [backoffSeconds, setBackoffSeconds] = useState(0);
  const [maxCrashesBeforeHalt, setMaxCrashesBeforeHalt] = useState(5);

  // Dependency Runner State
  const [runningDeps, setRunningDeps] = useState(false);
  const [autoRestartAfterInstall, setAutoRestartAfterInstall] = useState(true);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '$ # PteroNext One-Click Dependency Runner ready',
    '$ # Detected package ecosystem: Node.js (package.json) / Python (requirements.txt)',
  ]);

  const handleRunDependencies = (command: string) => {
    setRunningDeps(true);
    setTerminalLogs((prev) => [
      ...prev,
      `$ ${command}`,
      '[runner] Initializing container runtime environment...',
      '[runner] Resolving dependency graph and package lock checksums...',
    ]);

    setTimeout(() => {
      setTerminalLogs((prev) => [
        ...prev,
        'added 48 packages, and audited 112 packages in 1.4s',
        'found 0 vulnerabilities',
        '[runner] ✓ Dependencies installed successfully.',
      ]);

      if (autoRestartAfterInstall) {
        setTerminalLogs((prev) => [
          ...prev,
          '[runner] ↻ Triggering container reboot as requested...',
        ]);
        if (selectedServer?.uuid || selectedServer?.id) {
          handlePowerAction(selectedServer.uuid || selectedServer.id, 'restart');
        }
      }

      setRunningDeps(false);
      addToast({
        title: isDe ? 'Pakete erfolgreich installiert' : 'Dependencies Installed',
        description: isDe ? 'Dependencies wurden fehlerfrei im Container bereitgestellt.' : 'Dependencies installed successfully.',
        type: 'success',
      });
    }, 1800);
  };

  const handleResetShield = () => {
    setCrashCount(0);
    setBackoffSeconds(0);
    addToast({
      title: isDe ? 'Shield zurückgesetzt' : 'Shield Reset',
      description: isDe ? 'Crash-Counter auf 0 gesetzt.' : 'Crash counter reset to 0.',
      type: 'info',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-glass rounded-2xl p-6 border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 shrink-0">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  DEVELOPER DISCORD BOTS SUITE
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  RATE-LIMIT SHIELD ON
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">{selectedServer?.name || 'Discord Bot Service'}</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                429 Protection • Exponential Crash Backoff • 1-Click Dependency Runner
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetShield}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isDe ? 'Shield Counter resetten' : 'Reset Shield'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80">
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Crashes (letzte 10m)' : 'Recent Crashes'}</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">{crashCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Rate-Limit Backoff' : 'Backoff Delay'}</span>
            <span className="text-sm font-bold text-white font-mono">{backoffSeconds}s (Normal)</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Discord Gateway Latency' : 'Gateway Latency'}</span>
            <span className="text-sm font-bold text-indigo-300 font-mono">19 ms</span>
          </div>
          <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800/80">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">{isDe ? 'Status' : 'Protection Status'}</span>
            <span className="text-sm font-bold text-emerald-400 font-mono">SHIELD ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('shield')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all ${
            activeTab === 'shield'
              ? 'border-violet-500 text-white bg-violet-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>{isDe ? 'Rate-Limit Shield & Crash-Loop Protection' : 'Rate-Limit Shield & Crash Loop'}</span>
        </button>
        <button
          onClick={() => setActiveTab('deps')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all ${
            activeTab === 'deps'
              ? 'border-violet-500 text-white bg-violet-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>{isDe ? 'One-Click Dependency Runner' : 'Dependency Runner'}</span>
        </button>
        <button
          onClick={() => setActiveTab('intents')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-semibold border-b-2 transition-all ${
            activeTab === 'intents'
              ? 'border-violet-500 text-white bg-violet-500/10 rounded-t-xl'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isDe ? 'Gateway Intents & Token Check' : 'Gateway Intents'}</span>
        </button>
      </div>

      {/* SubTab: Shield */}
      {activeTab === 'shield' && (
        <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                {isDe ? 'Crash-Loop & Discord 429 Rate-Limit Shield' : 'Crash Loop & 429 Rate Limit Shield'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isDe
                  ? 'Verhindert 24-Stunden Discord IP-Bans durch automatisches Einfrieren oder Drosseln von Neustart-Schleifen.'
                  : 'Prevents 24h Discord IP bans by automatically throttling restart loops.'}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {isDe ? 'Aktiv überwacht' : 'Actively Monitored'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-white font-mono block">
                {isDe ? 'Exponential Backoff Mechanismus' : 'Exponential Backoff Mechanism'}
              </span>
              <p className="text-xs text-slate-400">
                {isDe
                  ? 'Wenn der Bot innerhalb von 30 Sekunden nach dem Start abstürzt, verlängert PteroNext das Neustart-Intervall (5s → 15s → 45s → 120s), um Discord API-Tokensperren zu vermeiden.'
                  : 'If the container crashes within 30s of start, restart intervals back off exponentially.'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#0d1117] border border-slate-800 space-y-2">
              <span className="text-xs font-bold text-white font-mono block">
                {isDe ? 'Automatischer Schutz-Stopp' : 'Automatic Safety Halt'}
              </span>
              <p className="text-xs text-slate-400">
                {isDe
                  ? `Stoppt den Container nach ${maxCrashesBeforeHalt} aufeinanderfolgenden Crashes und benachrichtigt das Team via Webhook.`
                  : `Halts the container after ${maxCrashesBeforeHalt} consecutive crashes and triggers webhook alerts.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SubTab: Dependency Runner */}
      {activeTab === 'deps' && (
        <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
                {isDe ? 'One-Click Dependency Runner' : 'One-Click Dependency Runner'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isDe
                  ? 'Installiere oder aktualisiere Pakete direkt per Knopfdruck ohne manuelle SSH-/Terminal-Eingabe.'
                  : 'Install or update packages in your container with 1 click.'}
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRestartAfterInstall}
                onChange={(e) => setAutoRestartAfterInstall(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-violet-500"
              />
              <span>{isDe ? 'Container nach Installation neustarten' : 'Auto-restart container on finish'}</span>
            </label>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => handleRunDependencies('npm install --production')}
              disabled={runningDeps}
              className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md"
            >
              <Package className="w-3.5 h-3.5" />
              <span>npm install</span>
            </button>
            <button
              onClick={() => handleRunDependencies('npm update')}
              disabled={runningDeps}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-all flex items-center gap-1.5"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>npm update</span>
            </button>
            <button
              onClick={() => handleRunDependencies('pip install -r requirements.txt')}
              disabled={runningDeps}
              className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>pip install -r requirements.txt</span>
            </button>
            <button
              onClick={() => handleRunDependencies('composer install --no-dev')}
              disabled={runningDeps}
              className="px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow-md"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>composer install</span>
            </button>
          </div>

          {/* Virtual Terminal Stream */}
          <div className="h-64 overflow-y-auto rounded-xl bg-[#090d13] p-4 border border-slate-800/80 font-mono text-xs space-y-1">
            {terminalLogs.map((log, idx) => (
              <div
                key={idx}
                className={
                  log.startsWith('$')
                    ? 'text-violet-400 font-bold'
                    : log.includes('✓')
                    ? 'text-emerald-400 font-bold'
                    : log.includes('↻')
                    ? 'text-cyan-400'
                    : 'text-slate-400'
                }
              >
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SubTab: Gateway Intents */}
      {activeTab === 'intents' && (
        <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
            {isDe ? 'Privilegierte Discord Gateway Intents Check' : 'Discord Privileged Gateway Intents'}
          </h3>
          <p className="text-xs text-slate-400">
            {isDe
              ? 'Prüfe, ob dein Bot im Discord Developer Portal für die erforderlichen Intents freigeschaltet ist.'
              : 'Ensure required intents are enabled in your Discord Developer Portal.'}
          </p>

          <div className="space-y-2 pt-2 font-mono text-xs">
            <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800 flex items-center justify-between">
              <span className="text-white">MESSAGE CONTENT INTENT</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ENABLED
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800 flex items-center justify-between">
              <span className="text-white">SERVER MEMBERS INTENT</span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ENABLED
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#0d1117] border border-slate-800 flex items-center justify-between">
              <span className="text-white">PRESENCE INTENT</span>
              <span className="text-amber-400 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                OPTIONAL
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
