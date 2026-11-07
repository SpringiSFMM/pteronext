import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useTranslation } from '../../i18n/useTranslation';
import { Server, Cpu, HardDrive, Radio, Activity, Zap, ShieldCheck } from 'lucide-react';

export const ClusterMetricsGrid: React.FC = () => {
  const { clusterMetrics, servers, nodes, adminNodes } = useApp();
  const { t } = useTranslation();

  const metrics = useMemo(() => {
    const runningCount = servers.filter((s) => s.status === 'running').length;
    const startingCount = servers.filter((s) => s.status === 'starting').length;
    const stoppedCount = servers.filter((s) => s.status === 'stopped' || s.status === 'offline').length;

    const totalServersCount = clusterMetrics.totalServers > 0 ? clusterMetrics.totalServers : servers.length;
    const serverProgress = totalServersCount > 0 ? (runningCount / totalServersCount) * 100 : 0;

    // Aggregate across all nodes
    const effectiveNodes = adminNodes.length > 0 ? adminNodes : nodes;
    const nodesSumRAMMB = effectiveNodes.reduce((acc, n) => acc + (n.ramTotalMB || 8192), 0);
    const nodesSumRAMGB = nodesSumRAMMB > 0 ? +(nodesSumRAMMB / 1024).toFixed(1) : 16.0;

    const ramTotal = clusterMetrics.ramTotalGB > 0 ? clusterMetrics.ramTotalGB : nodesSumRAMGB;

    // Calculate allocated RAM from clusterMetrics or sum of deployed servers
    const serversAllocatedRAMMB = servers.reduce((acc, s) => acc + (s.stats.memoryLimit || 0), 0);
    const serversAllocatedRAMGB = serversAllocatedRAMMB > 0 ? +(serversAllocatedRAMMB / 1024).toFixed(1) : 0;
    
    // Consistent memory: live used if reported, otherwise allocated server limits
    const ramUsed = (Number.isFinite(clusterMetrics.ramUsedGB) && clusterMetrics.ramUsedGB > 0)
      ? clusterMetrics.ramUsedGB
      : serversAllocatedRAMGB;

    const ramPercent = ramTotal > 0 ? Math.round((ramUsed / ramTotal) * 100) : 0;
    const isOverallocated = ramUsed > ramTotal;
    const freeRAM = Math.max(0, ramTotal - ramUsed);

    const safeCpuLoad = Number.isFinite(clusterMetrics.cpuUsedPercent) ? clusterMetrics.cpuUsedPercent : 0;
    const totalNodesCount = clusterMetrics.totalNodes > 0
      ? clusterMetrics.totalNodes
      : (effectiveNodes.length > 0 ? effectiveNodes.length : (servers.length > 0 ? 1 : 0));
    const activeNodesCount = clusterMetrics.activeNodes > 0
      ? clusterMetrics.activeNodes
      : (effectiveNodes.filter((n) => n.status === 'healthy').length || totalNodesCount);

    return {
      runningCount,
      startingCount,
      stoppedCount,
      totalServersCount,
      serverProgress,
      ramTotal,
      ramUsed,
      ramPercent,
      isOverallocated,
      freeRAM,
      safeCpuLoad,
      totalNodesCount,
      activeNodesCount,
    };
  }, [servers, nodes, adminNodes, clusterMetrics]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Online Workloads Card */}
      <div className="glass-panel glass-card-interactive rounded-2xl p-5 border border-slate-800/80 hover:border-emerald-500/40 transition-all duration-200 relative group overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        
        <div className="flex items-center justify-between mb-3.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            {t('dash_online_workloads')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-sm group-hover:scale-105 transition-transform">
            <Server className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
            {metrics.runningCount}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            / {metrics.totalServersCount} Deployed
          </span>
        </div>

        <div className="w-full bg-[#0d1117] rounded-full h-1.5 overflow-hidden mb-3 border border-slate-800/60">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 ease-out shadow-sm"
            style={{ width: `${Math.max(5, Math.min(100, metrics.serverProgress))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {metrics.runningCount} {t('dash_active')}
          </span>
          {metrics.startingCount > 0 && (
            <span className="text-amber-400 font-medium">
              +{metrics.startingCount} {t('dash_starting')}
            </span>
          )}
          <span className="text-slate-500">
            {metrics.stoppedCount} {t('dash_offline')}
          </span>
        </div>
      </div>

      {/* 2. Wings Nodes & Cluster Health */}
      <div className="glass-panel glass-card-interactive rounded-2xl p-5 border border-slate-800/80 hover:border-cyan-500/40 transition-all duration-200 relative group overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        <div className="flex items-center justify-between mb-3.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            {t('dash_wings_daemons')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shadow-sm group-hover:scale-105 transition-transform">
            <Radio className="w-4 h-4 animate-pulse-subtle" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
            {metrics.activeNodesCount}
          </span>
          <span className="text-xs text-slate-400 font-mono">
            / {metrics.totalNodesCount} {metrics.totalNodesCount === 1 ? 'Node Online' : 'Nodes Online'}
          </span>
        </div>

        <div className="w-full bg-[#0d1117] rounded-full h-1.5 overflow-hidden mb-3 border border-slate-800/60">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-sky-400 rounded-full transition-all duration-500 ease-out shadow-sm"
            style={{
              width: `${metrics.totalNodesCount > 0 ? (metrics.activeNodesCount / metrics.totalNodesCount) * 100 : 0}%`,
            }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            {t('dash_mesh_health')}
          </span>
          <span className="text-slate-400">
            TLS Encrypted
          </span>
        </div>
      </div>

      {/* 3. Total Cluster CPU Allocation */}
      <div className="glass-panel glass-card-interactive rounded-2xl p-5 border border-slate-800/80 hover:border-indigo-500/40 transition-all duration-200 relative group overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        <div className="flex items-center justify-between mb-3.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            {t('dash_cluster_compute')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm group-hover:scale-105 transition-transform">
            <Cpu className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
            {metrics.safeCpuLoad}%
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {t('dash_allocated_load')}
          </span>
        </div>

        <div className="w-full bg-[#0d1117] rounded-full h-1.5 overflow-hidden mb-3 border border-slate-800/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              metrics.safeCpuLoad > 85
                ? 'bg-rose-500'
                : metrics.safeCpuLoad > 65
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-indigo-500 to-purple-400'
            }`}
            style={{ width: `${Math.max(3, Math.min(100, metrics.safeCpuLoad))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="flex items-center gap-1.5 text-indigo-300 font-semibold">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            {clusterMetrics.cpuCores || 4} Total Cores
          </span>
          <span className="text-slate-400">
            Realtime
          </span>
        </div>
      </div>

      {/* 4. Distributed Cluster Memory */}
      <div className="glass-panel glass-card-interactive rounded-2xl p-5 border border-slate-800/80 hover:border-fuchsia-500/40 transition-all duration-200 relative group overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-500/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        <div className="flex items-center justify-between mb-3.5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
            {t('dash_memory_allocation')}
          </span>
          <div className="w-9 h-9 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center text-fuchsia-400 shadow-sm group-hover:scale-105 transition-transform">
            <HardDrive className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-extrabold text-white font-mono tracking-tight tabular-nums">
            {metrics.ramUsed} GB
          </span>
          <span className="text-xs text-slate-400 font-mono">
            / {metrics.ramTotal} GB Total
          </span>
        </div>

        <div className="w-full bg-[#0d1117] rounded-full h-1.5 overflow-hidden mb-3 border border-slate-800/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              metrics.ramPercent > 100
                ? 'bg-gradient-to-r from-rose-500 to-amber-500 shadow-sm'
                : metrics.ramPercent > 85
                ? 'bg-rose-500'
                : metrics.ramPercent > 70
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-fuchsia-500 to-pink-400'
            }`}
            style={{ width: `${Math.max(3, Math.min(100, metrics.ramPercent))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className={`font-semibold ${metrics.isOverallocated ? 'text-amber-400' : 'text-fuchsia-300'}`}>
            {metrics.ramPercent}% {t('dash_capacity')}
          </span>
          <span className={metrics.isOverallocated ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
            {metrics.isOverallocated ? (
              `+${(metrics.ramUsed - metrics.ramTotal).toFixed(1)} GB Overallocated`
            ) : (
              `${metrics.freeRAM.toFixed(1)} GB ${t('dash_free')}`
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
