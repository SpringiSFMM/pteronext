import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ClusterMetricsGrid } from './ClusterMetricsGrid';
import { NodeStatusMatrix } from './NodeStatusMatrix';
import { ActivityStream } from './ActivityStream';
import { ServerCard } from '../servers/ServerCard';
import { StatusBadge } from '../common/StatusBadge';
import { ServerStatus } from '../../types';
import { useTranslation } from '../../i18n/useTranslation';
import {
  Server,
  Plus,
  Play,
  RotateCw,
  Square,
  Skull,
  Globe,
  Copy,
  Check,
  Terminal,
  LayoutGrid,
  List as ListIcon,
  Search,
  Radio,
  Layers,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  X,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    servers,
    setActiveView,
    selectServerAndNavigate,
    handlePowerAction,
    addToast,
    setIsCreateServerOpen,
    currentUser,
  } = useApp();

  const isAdmin = currentUser?.rootAdmin || currentUser?.role === 'root_admin';

  const { t } = useTranslation();

  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<ServerStatus | 'all'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const runningCount = servers.filter((s) => s.status === 'running').length;
  const startingCount = servers.filter((s) => s.status === 'starting').length;
  const stoppedCount = servers.filter((s) => s.status === 'stopped' || s.status === 'offline').length;

  const handleCopyIp = (e: React.MouseEvent, allocation: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(allocation);
    setCopiedId(id);
    addToast({
      title: 'Allocation Copied',
      description: `Copied ${allocation} to clipboard`,
      type: 'info',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAction = (
    e: React.MouseEvent,
    serverId: string,
    action: 'start' | 'restart' | 'stop' | 'kill'
  ) => {
    e.stopPropagation();
    handlePowerAction(serverId, action);
  };

  const filteredServers = servers.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.egg.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.node.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.allocation.toLowerCase().includes(searchFilter.toLowerCase());

    const matchesStatus = statusFilter === 'all' ? true : s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 view-enter pb-8">
      {/* Hero Welcome & Cluster Control Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800/80 relative overflow-hidden shadow-xl bg-gradient-to-r from-[#161b22]/90 via-[#1c2230]/70 to-[#161b22]/90">
        {/* Subtle Ambient Background Orbs */}
        <div className="absolute top-0 right-0 w-80 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {t('dash_cluster_operational')}
              </span>
              <span className="text-[11px] font-mono text-slate-400 bg-[#0d1117]/80 px-2.5 py-1 rounded-full border border-slate-800">
                PteroNext v2.8.8 Enterprise
              </span>
            </div>
            
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-sans flex items-center gap-2">
              <span>{t('dash_cluster_hub')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl leading-relaxed">
              {t('dash_cluster_desc')}
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {isAdmin && (
              <button
                onClick={() => setActiveView('admin-nodes')}
                className="px-3.5 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-mono font-medium transition-all flex items-center gap-2 shadow-sm"
              >
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>{t('dash_nodes_matrix')}</span>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => setIsCreateServerOpen(true)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-95 flex items-center gap-2 border border-indigo-400/30"
              >
                <Plus className="w-4 h-4" />
                <span>{t('dash_deploy_instance')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top Stat Cards: Telemetry Sparklines & Cluster Metrics (Admin Only) */}
      {isAdmin && <ClusterMetricsGrid />}

      {/* Workload Instances Section */}
      <div className="space-y-4">
        {/* Filter and Control Bar */}
        <div className="glass-panel rounded-2xl p-4 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
          {/* Title & Counter */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                {t('nav_workloads')}
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-300 bg-[#0d1117] px-2.5 py-0.5 rounded-full border border-slate-800">
              {filteredServers.length} / {servers.length}
            </span>
          </div>

          {/* Controls: Search, Status Pills & View Mode */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-64 flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={t('dash_filter_placeholder')}
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full h-8 bg-[#0d1117] border border-slate-800 rounded-xl pl-9 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--theme-accent)] font-mono transition-colors"
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Status Segmented Control */}
            <div className="flex items-center bg-[#0d1117] border border-slate-800 rounded-xl p-1 gap-1">
              {[
                { id: 'all', label: t('dash_all'), count: servers.length },
                { id: 'running', label: t('dash_running'), count: runningCount },
                { id: 'starting', label: t('dash_starting'), count: startingCount },
                { id: 'stopped', label: t('dash_stopped'), count: stoppedCount },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setStatusFilter(item.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    statusFilter === item.id
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    statusFilter === item.id ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.count}
                  </span>
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#0d1117] border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => setViewMode('table')}
                title="Table View"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Server Table / Grid View */}
        {viewMode === 'table' ? (
          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#0d1117]/90 text-slate-400 border-b border-slate-800 font-mono uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="py-3 px-4 w-32">{t('common_status')}</th>
                    <th className="py-3 px-4">{t('dash_instance_egg')}</th>
                    <th className="py-3 px-4">{t('dash_node_allocation')}</th>
                    <th className="py-3 px-4">{t('dash_memory_allocation')}</th>
                    <th className="py-3 px-4">{t('dash_cluster_compute')}</th>
                    <th className="py-3 px-4 text-right">{t('dash_power_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredServers.map((server) => {
                    const isRunning = server.status === 'running';
                    const isStarting = server.status === 'starting';

                    return (
                      <tr
                        key={server.id}
                        onClick={() => selectServerAndNavigate(server, 'console')}
                        className="hover:bg-slate-800/35 cursor-pointer transition-colors group"
                      >
                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={server.status} size="sm" />
                        </td>

                        {/* Name & Egg */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white group-hover:text-indigo-300 transition-colors truncate max-w-[220px]">
                              {server.name}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-semibold uppercase">
                              {server.egg}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate max-w-[280px] mt-0.5">
                            {server.description || 'No description provided'}
                          </p>
                        </td>

                        {/* Node & IP Allocation */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleCopyIp(e, server.allocation, server.id)}
                              className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300 bg-[#0d1117] hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-800 transition-colors group/btn"
                              title="Click to copy IP:Port"
                            >
                              <Globe className="w-3 h-3 text-slate-400 group-hover/btn:text-indigo-400" />
                              <span>{server.allocation}</span>
                              {copiedId === server.id ? (
                                <Check className="w-3 h-3 text-emerald-400 animate-bounce" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-500 group-hover/btn:text-slate-300" />
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            {server.node} ({server.nodeLocation})
                          </p>
                        </td>

                        {/* Memory */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-[11px] text-slate-300 flex items-center justify-between max-w-[140px]">
                            <span>{(server.stats.memory / 1024).toFixed(1)} GB</span>
                            <span className="text-slate-500 text-[10px]">
                              / {(server.stats.memoryLimit / 1024).toFixed(0)} GB
                            </span>
                          </div>
                          <div className="w-32 bg-[#0d1117] rounded-full h-1.5 mt-1.5 overflow-hidden border border-slate-800/60">
                            <div
                              className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(
                                  100,
                                  (server.stats.memory / server.stats.memoryLimit) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </td>

                        {/* CPU */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-200">
                          <div className="flex items-center justify-between max-w-[120px]">
                            <span className="font-bold">{server.stats.cpu}%</span>
                            <span className="text-[10px] text-slate-500">vCPU</span>
                          </div>
                          <div className="w-24 bg-[#0d1117] rounded-full h-1.5 mt-1.5 overflow-hidden border border-slate-800/60">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                server.stats.cpu > 80
                                  ? 'bg-rose-500'
                                  : server.stats.cpu > 50
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, server.stats.cpu)}%` }}
                            />
                          </div>
                        </td>

                        {/* Power Action Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div
                            className="flex items-center justify-end gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {!isRunning ? (
                              <button
                                onClick={(e) => handleAction(e, server.id, 'start')}
                                disabled={isStarting}
                                title="Start Container"
                                className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => handleAction(e, server.id, 'restart')}
                                  title="Restart Container"
                                  className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-all active:scale-95 shadow-sm"
                                >
                                  <RotateCw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={(e) => handleAction(e, server.id, 'stop')}
                                  title="Stop Container"
                                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all active:scale-95 shadow-sm"
                                >
                                  <Square className="w-3.5 h-3.5 fill-current" />
                                </button>
                                <button
                                  onClick={(e) => handleAction(e, server.id, 'kill')}
                                  title="Kill Container (SIGKILL)"
                                  className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-all active:scale-95 shadow-sm"
                                >
                                  <Skull className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                selectServerAndNavigate(server, 'console');
                              }}
                              title="Open Terminal Console"
                              className="p-2 rounded-xl bg-[#0d1117] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-all active:scale-95 shadow-sm"
                            >
                              <Terminal className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {filteredServers.length === 0 && (
              <div className="py-14 text-center text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <Server className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-white">
                  {servers.length === 0 ? 'No Game Servers Deployed' : 'No matching servers found'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {servers.length === 0
                    ? 'Your compute cluster is clean and ready. Deploy your first game server container to get started.'
                    : 'Try adjusting your search query or status filter.'}
                </p>
                {servers.length === 0 && (
                  <button
                    onClick={() => setIsCreateServerOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-bold transition-all shadow-lg active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    Deploy Game Server
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Grid View */
          filteredServers.length === 0 ? (
            <div className="py-14 text-center text-slate-400 glass-panel rounded-2xl border border-slate-800/80">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Server className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-white">
                {servers.length === 0 ? 'No Game Servers Deployed' : 'No matching servers found'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {servers.length === 0
                  ? 'Your compute cluster is clean and ready. Deploy your first game server container to get started.'
                  : 'Try adjusting your search query or status filter.'}
              </p>
              {servers.length === 0 && (
                <button
                  onClick={() => setIsCreateServerOpen(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-bold transition-all shadow-lg active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Deploy Game Server
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServers.map((server) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          )
        )}
      </div>

      {/* Grid: Node Infrastructure & Audit Activity Stream (Admin Only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 items-start">
          <NodeStatusMatrix />
          <ActivityStream />
        </div>
      )}
    </div>
  );
};
