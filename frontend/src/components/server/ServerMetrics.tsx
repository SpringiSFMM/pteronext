import React, { useState } from 'react';
import { ServerStats } from '../../types';
import { WebSocketConnectionStatus, MetricsHistoryPoint } from './types';
import { Sparkline } from './Sparkline';
import { MetricsChart } from './MetricsChart';
import { formatBytes, formatSpeed } from './utils';
import {
  Cpu,
  Activity,
  HardDrive,
  Wifi,
  WifiOff,
  RefreshCw,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ServerMetricsProps {
  stats: ServerStats;
  history: MetricsHistoryPoint[];
  connectionStatus: WebSocketConnectionStatus;
  latency?: number;
  onReconnect?: () => void;
  className?: string;
  showHistoricalChart?: boolean;
}

export const ServerMetrics: React.FC<ServerMetricsProps> = ({
  stats,
  history,
  connectionStatus,
  latency = 14,
  onReconnect,
  className = '',
  showHistoricalChart = true,
}) => {
  const [chartExpanded, setChartExpanded] = useState(false);

  // CPU metrics
  const cpuPercent = Math.max(0, stats.cpu || 0);
  const cpuHistory = history.map((h) => h.cpu);
  const cpuColor = cpuPercent > 85 ? 'rose' : cpuPercent > 60 ? 'amber' : 'emerald';

  // Memory metrics
  const memUsedMB = stats.memory || 0;
  const memLimitMB = stats.memoryLimit || 4096;
  const memPercent = Math.min(100, Math.max(0, (memUsedMB / (memLimitMB || 1)) * 100));
  const memHistory = history.map((h) => h.memoryPercent);
  const memColor = memPercent > 90 ? 'rose' : memPercent > 75 ? 'amber' : 'emerald';

  // Disk metrics
  const diskUsedMB = stats.disk || 0;
  const diskLimitMB = stats.diskLimit || 20480;
  const diskPercent = Math.min(100, Math.max(0, (diskUsedMB / (diskLimitMB || 1)) * 100));

  // Network metrics (Rx / Tx in KB/s)
  const rxBytes = (stats.networkRx || 0) * 1024;
  const txBytes = (stats.networkTx || 0) * 1024;

  return (
    <div className={`space-y-4 ${className}`}>
      {/* WebSocket Status Indicator Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#0d131f]/90 border border-slate-800/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          {/* Pulsing Status Dot */}
          <div className="relative flex items-center justify-center">
            {connectionStatus === 'connected' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="absolute w-4 h-4 rounded-full bg-emerald-400/40 animate-ping"></span>
              </>
            ) : connectionStatus === 'reconnecting' ? (
              <>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="absolute w-4 h-4 rounded-full bg-amber-400/40 animate-ping"></span>
              </>
            ) : (
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-200">
              {connectionStatus === 'connected' && 'WebSocket Active'}
              {connectionStatus === 'connecting' && 'Establishing Connection...'}
              {connectionStatus === 'reconnecting' && 'Reconnecting to Daemon...'}
              {connectionStatus === 'disconnected' && 'Connection Dropped'}
              {connectionStatus === 'error' && 'Socket Error'}
            </span>

            {connectionStatus === 'connected' && (
              <span className="text-[11px] font-mono text-zinc-300 bg-white/[0.05] border border-white/10 px-1.5 py-0.5 rounded">
                {latency}ms latency
              </span>
            )}
          </div>
        </div>

        {/* Right Action: Reconnect button & Expand Chart toggle */}
        <div className="flex items-center gap-2">
          {connectionStatus !== 'connected' && onReconnect && (
            <button
              type="button"
              onClick={onReconnect}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white/10 text-white hover:bg-white/20 border border-white/20 transition-colors"
            >
              <RefreshCw className="w-3 h-3 animate-spin" />
              Reconnect Now
            </button>
          )}

          {showHistoricalChart && (
            <button
              type="button"
              onClick={() => setChartExpanded(!chartExpanded)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-md transition-colors"
            >
              <span>{chartExpanded ? 'Hide' : 'Historical'} Chart</span>
              {chartExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      </div>

      {/* Main 4 Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. CPU Usage Card */}
        <div className="p-3.5 rounded-xl border border-slate-800/80 bg-[#0d131f]/90 hover:border-zinc-700 transition-all shadow-md group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-zinc-300" />
              CPU Usage
            </span>
            <span
              className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                cpuColor === 'rose'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : cpuColor === 'amber'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}
            >
              {cpuColor === 'rose' ? 'HIGH' : 'NORMAL'}
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-100">
              {cpuPercent.toFixed(1)}
              <span className="text-sm font-normal text-slate-400 ml-0.5">%</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">4 vCPU Cores</span>
          </div>

          {/* Mini Real-time Sparkline */}
          <div className="pt-1">
            <Sparkline
              data={cpuHistory}
              color={cpuColor}
              height={36}
              min={0}
              max={100}
              unit="%"
            />
          </div>
        </div>

        {/* 2. Memory Usage Card */}
        <div className="p-3.5 rounded-xl border border-slate-800/80 bg-[#0d131f]/90 hover:border-emerald-500/40 transition-all shadow-md group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Memory (RAM)
            </span>
            <span
              className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                memColor === 'rose'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
              }`}
            >
              {memPercent.toFixed(0)}%
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-100">
              {(memUsedMB / 1024).toFixed(2)}
              <span className="text-sm font-normal text-slate-400 ml-0.5">GB</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              of {(memLimitMB / 1024).toFixed(1)} GB
            </span>
          </div>

          {/* Progress bar + Mini Sparkline */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  memColor === 'rose' ? 'bg-rose-500' : 'bg-emerald-400'
                }`}
                style={{ width: `${memPercent}%` }}
              ></div>
            </div>
            <Sparkline
              data={memHistory}
              color={memColor}
              height={28}
              min={0}
              max={100}
              unit="%"
              showLatestDot={false}
            />
          </div>
        </div>

        {/* 3. Disk I/O & Storage Card */}
        <div className="p-3.5 rounded-xl border border-slate-800/80 bg-[#0d131f]/90 hover:border-amber-500/40 transition-all shadow-md group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              Disk Storage
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
              {diskPercent.toFixed(0)}%
            </span>
          </div>

          <div className="flex items-baseline justify-between mb-2">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-100">
              {(diskUsedMB / 1024).toFixed(2)}
              <span className="text-sm font-normal text-slate-400 ml-0.5">GB</span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              of {(diskLimitMB / 1024).toFixed(1)} GB
            </span>
          </div>

          {/* Disk Meter */}
          <div className="space-y-2 pt-2">
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${diskPercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span>Read/Write: Active</span>
              <span className="text-amber-400/90 font-medium">NVMe Pool</span>
            </div>
          </div>
        </div>

        {/* 4. Network I/O Card */}
        <div className="p-3.5 rounded-xl border border-slate-800/80 bg-[#0d131f]/90 hover:border-violet-500/40 transition-all shadow-md group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-violet-400" />
              Network I/O
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-violet-950 text-violet-300 border border-violet-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
              FLOW
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            {/* Inbound / Download */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                <ArrowDownLeft className="w-3 h-3 text-emerald-400" />
                Inbound (RX)
              </div>
              <div className="text-sm font-bold font-mono text-slate-100 mt-1">
                {formatSpeed(rxBytes)}
              </div>
            </div>

            {/* Outbound / Upload */}
            <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800">
              <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                <ArrowUpRight className="w-3 h-3 text-zinc-300" />
                Outbound (TX)
              </div>
              <div className="text-sm font-bold font-mono text-slate-100 mt-1">
                {formatSpeed(txBytes)}
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mt-2 px-1">
            <span>Interface: eth0</span>
            <span>TCP / UDP OK</span>
          </div>
        </div>
      </div>

      {/* Expandable Detailed Historical Metrics Chart */}
      {showHistoricalChart && chartExpanded && (
        <MetricsChart history={history} className="animate-in fade-in duration-200" />
      )}
    </div>
  );
};
