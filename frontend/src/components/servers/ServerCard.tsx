import React, { useState } from 'react';
import { Server } from '../../types';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/StatusBadge';
import { ResourceMeter } from '../common/ResourceMeter';
import {
  Play,
  RotateCw,
  Square,
  Skull,
  Copy,
  Check,
  Cpu,
  HardDrive,
  Globe,
  ChevronRight,
  Terminal,
  Loader2,
} from 'lucide-react';

interface ServerCardProps {
  server: Server;
  isSelected?: boolean;
  onToggleSelect?: (e: React.MouseEvent) => void;
  isBulkMode?: boolean;
}

export const ServerCard: React.FC<ServerCardProps> = ({
  server,
  isSelected = false,
  onToggleSelect,
  isBulkMode = false,
}) => {
  const { selectServerAndNavigate, handlePowerAction, addToast, pendingPowerActions } = useApp();
  const [copied, setCopied] = useState(false);

  const pendingAction = pendingPowerActions[server.id] || pendingPowerActions[server.uuid];
  const isActionPending = Boolean(pendingAction);

  const handleCopyIp = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(server.allocation);
    setCopied(true);
    addToast({
      title: 'Allocation Copied',
      description: `Copied ${server.allocation} to clipboard`,
      type: 'info',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = (e: React.MouseEvent, action: 'start' | 'restart' | 'stop' | 'kill') => {
    e.stopPropagation();
    if (isActionPending) return;
    handlePowerAction(server.id, action);
  };

  const isRunning = server.status === 'running';
  const isStarting = server.status === 'starting' || pendingAction === 'start' || pendingAction === 'restart';

  return (
    <div
      onClick={() => {
        if (isBulkMode && onToggleSelect) {
          onToggleSelect(null as any);
        } else {
          selectServerAndNavigate(server, 'console');
        }
      }}
      className={`group relative rounded-2xl p-5 transition-all duration-300 flex flex-col justify-between cursor-pointer glass-panel glass-card-interactive shadow-lg hover:border-[var(--theme-accent)] hover:shadow-[0_0_24px_var(--theme-accent-glow)] ${
        isSelected
          ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-500/5'
          : isStarting
          ? 'border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.25)] animate-pulse'
          : isRunning
          ? 'border-emerald-500/30 hover:border-emerald-500/50'
          : 'border-[#30363d]'
      }`}
    >
      {/* Top Ambient State & Theme Glow Line */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--theme-accent), transparent)',
          boxShadow: '0 0 12px var(--theme-accent-glow)',
        }}
      />

      {/* Top Header: Title, Egg, Status Badge */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          {isBulkMode && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(e);
              }}
              className="pt-0.5 cursor-pointer shrink-0 mr-1"
            >
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                    : 'border-[#30363d] bg-[#0d1117] hover:border-slate-500'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase tracking-wide">
                {server.egg}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {server.nodeLocation}
              </span>
            </div>
            <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors truncate font-sans">
              {server.name}
            </h3>
            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 font-sans">
              {server.description || 'No description provided'}
            </p>
          </div>

          <StatusBadge status={server.status} size="sm" />
        </div>

        {/* IP / Allocation with copy */}
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={handleCopyIp}
            className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-[#0d1117] px-2.5 py-1 rounded-xl border border-slate-800 hover:border-slate-700 hover:text-white transition-all group/btn"
            title="Click to copy IP"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-indigo-400" />
            <span>{server.allocation}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400 animate-bounce" />
            ) : (
              <Copy className="w-3 h-3 text-slate-500 group-hover/btn:text-slate-300" />
            )}
          </button>
        </div>

        {/* Live Resource Meters */}
        <div className="space-y-3 pt-3 border-t border-[#30363d]/80 mb-4">
          <ResourceMeter
            label="CPU Load"
            value={server.stats.cpu}
            unit="%"
            icon={<Cpu className="w-3.5 h-3.5" />}
            size="sm"
          />

          <ResourceMeter
            label="Memory"
            value={server.stats.memory}
            max={server.stats.memoryLimit}
            displayValue={`${(server.stats.memory / 1024).toFixed(1)} / ${(
              server.stats.memoryLimit / 1024
            ).toFixed(0)} GB`}
            icon={<HardDrive className="w-3.5 h-3.5" />}
            size="sm"
          />
        </div>
      </div>

      {/* Bottom Footer: Quick Power Controls & Terminal Jump */}
      <div className="pt-3 border-t border-[#30363d]/80 flex items-center justify-between gap-2">
        {/* Power Buttons */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {!isRunning && (
            <button
              onClick={(e) => handleAction(e, 'start')}
              disabled={isStarting || isActionPending}
              title={pendingAction === 'start' ? 'Starting...' : 'Start Server'}
              className="p-1.5 rounded-lg bg-[#21262d] hover:bg-emerald-500/20 text-emerald-400 border border-[#30363d] hover:border-emerald-500/30 transition-all disabled:opacity-60"
            >
              {pendingAction === 'start' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
            </button>
          )}

          {isRunning && (
            <>
              <button
                onClick={(e) => handleAction(e, 'restart')}
                disabled={isActionPending}
                title={pendingAction === 'restart' ? 'Restarting...' : 'Restart Server'}
                className="p-1.5 rounded-lg bg-[#21262d] hover:bg-amber-500/20 text-amber-400 border border-[#30363d] hover:border-amber-500/30 transition-all disabled:opacity-60"
              >
                {pendingAction === 'restart' ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                ) : (
                  <RotateCw className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                onClick={(e) => handleAction(e, 'stop')}
                disabled={isActionPending}
                title={pendingAction === 'stop' ? 'Stopping...' : 'Graceful Stop'}
                className="p-1.5 rounded-lg bg-[#21262d] hover:bg-slate-700 text-slate-300 hover:text-white border border-[#30363d] transition-all disabled:opacity-60"
              >
                {pendingAction === 'stop' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />
                ) : (
                  <Square className="w-3.5 h-3.5 fill-current" />
                )}
              </button>
              <button
                onClick={(e) => handleAction(e, 'kill')}
                disabled={isActionPending}
                title={pendingAction === 'kill' ? 'Killing...' : 'Kill Immediately'}
                className="p-1.5 rounded-lg bg-[#21262d] hover:bg-rose-500/20 text-rose-400 border border-[#30363d] hover:border-rose-500/30 transition-all disabled:opacity-60"
              >
                {pendingAction === 'kill' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                ) : (
                  <Skull className="w-3.5 h-3.5" />
                )}
              </button>
            </>
          )}
        </div>

        {/* View Details button */}
        <button
          onClick={() => selectServerAndNavigate(server, 'console')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white border border-[#30363d] text-xs font-medium transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-slate-400" />
          <span>Console</span>
          <ChevronRight className="w-3 h-3 text-slate-500" />
        </button>
      </div>
    </div>
  );
};
