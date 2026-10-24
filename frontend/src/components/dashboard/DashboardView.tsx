import React from 'react';
import { useApp } from '../../context/AppContext';
import { ClusterMetricsGrid } from './ClusterMetricsGrid';
import { NodeStatusMatrix } from './NodeStatusMatrix';
import { ActivityStream } from './ActivityStream';
import { ServerCard } from '../servers/ServerCard';
import { useTranslation } from '../../i18n/useTranslation';
import {
  Server,
  Plus,
  ArrowRight,
  Layers,
  Radio,
  Sparkles,
  Zap,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    servers,
    setActiveView,
    setIsCreateServerOpen,
    currentUser,
    systemVersion,
  } = useApp();

  const isAdmin = Boolean(currentUser?.rootAdmin || currentUser?.role === 'root_admin' || (currentUser as any)?.root_admin === 1);
  const { t, language } = useTranslation();
  const isDe = language === 'de';

  // Focused preview of top 3 servers for fast, decluttered overview
  const previewServers = servers.slice(0, 3);

  return (
    <div className="space-y-6 view-enter pb-8">
      {/* Sleek Hero Welcome & Cluster Hub Banner */}
      <div className="glass-panel rounded-2xl p-6 sm:p-7 border border-slate-800/80 relative overflow-hidden shadow-xl bg-gradient-to-r from-[#161b22]/95 via-[#1c2230]/80 to-[#161b22]/95">
        {/* Subtle Ambient Background Orbs */}
        <div className="absolute top-0 right-0 w-80 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                {t('dash_cluster_operational')}
              </span>
              <span className="text-[11px] font-mono text-slate-400 bg-[#0d1117]/80 px-2.5 py-0.5 rounded-full border border-slate-800">
                PteroNext {systemVersion || 'v2.9.3'} Enterprise
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-sans flex items-center gap-2">
              <span>{t('dash_cluster_hub')}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
              {t('dash_cluster_desc')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {isAdmin ? (
              <>
                <button
                  onClick={() => setActiveView('admin-nodes')}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 text-xs font-mono font-medium transition-all flex items-center gap-2 shadow-sm"
                >
                  <Radio className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('dash_nodes_matrix')}</span>
                </button>
                <button
                  onClick={() => setIsCreateServerOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-indigo-500/25 active:scale-95 flex items-center gap-2 border border-indigo-400/30"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('dash_deploy_instance')}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setActiveView('servers')}
                className="px-4 py-2.5 rounded-xl bg-[#0d1117] hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-mono font-semibold transition-all shadow-md flex items-center gap-2 border border-slate-700 hover:border-indigo-500/50 cursor-pointer"
              >
                <Server className="w-4 h-4 text-indigo-400" />
                <span>{isDe ? 'Meine Server öffnen' : 'View My Servers'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cluster Metrics Grid (Admin Only) */}
      {isAdmin && <ClusterMetricsGrid />}

      {/* Quick Access to Instances Section (Streamlined to prevent duplication with ServerListView) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
              {isDe ? 'Schnellzugriff auf Server' : 'Quick Access Instances'}
            </h2>
            <span className="text-xs font-mono text-slate-400 bg-[#0d1117] px-2 py-0.5 rounded-full border border-slate-800">
              {servers.length}
            </span>
          </div>

          {servers.length > 0 && (
            <button
              onClick={() => setActiveView('servers')}
              className="flex items-center gap-1.5 text-xs font-mono text-indigo-400 hover:text-white transition-colors group cursor-pointer"
            >
              <span>{isDe ? `Alle Server öffnen (${servers.length})` : `View all servers (${servers.length})`}</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {servers.length === 0 ? (
          <div className="py-14 text-center text-slate-400 glass-panel rounded-2xl border border-slate-800/80 bg-[#161b22]/70">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Server className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white">
              {isDe ? 'Noch keine Server bereitgestellt' : 'No servers deployed yet'}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {isDe
                ? 'Dein Rechencluster ist betriebsbereit. Erstelle deine erste Instanz mit einem Klick.'
                : 'Your compute cluster is clean and ready. Deploy your first server container to get started.'}
            </p>
            {isAdmin && (
              <button
                onClick={() => setIsCreateServerOpen(true)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-mono text-xs font-bold transition-all shadow-lg active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>{isDe ? 'Ersten Server erstellen' : 'Deploy First Server'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {previewServers.map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        )}
      </div>

      {/* Grid: Node Infrastructure & Audit Activity Stream (Admin Only) */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2 items-start">
          <div className="lg:col-span-2">
            <NodeStatusMatrix />
          </div>
          <div>
            <ActivityStream />
          </div>
        </div>
      )}
    </div>
  );
};
