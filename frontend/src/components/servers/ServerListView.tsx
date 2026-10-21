import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ServerCard } from './ServerCard';
import { ServerCardSkeleton, ServerTableRowSkeleton } from './ServerCardSkeleton';
import { Server, ServerStatus, PowerAction } from '../../types';
import {
  Server as ServerIcon,
  Search,
  Filter,
  Plus,
  Download,
  LayoutGrid,
  List as ListIcon,
  Globe,
  Copy,
  Check,
  Terminal,
  CheckSquare,
  Square as SquareIcon,
  Play,
  RotateCw,
  Square,
  X,
  Layers,
  Loader2,
  UserCheck,
  Users,
} from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { useTranslation } from '../../i18n/useTranslation';

export const ServerListView: React.FC = () => {
  const {
    servers,
    isLoadingServers,
    searchQuery,
    setSearchQuery,
    selectServerAndNavigate,
    addToast,
    setIsCreateServerOpen,
    setIsImportModalOpen,
    bulkPowerAction,
    pendingPowerActions,
    currentUser,
  } = useApp();

  const { language } = useTranslation();
  const isDe = language === 'de';

  // Helper to determine ownership
  const isMyServer = (server: Server) => {
    if (!currentUser) return true;
    if (server.ownerId && currentUser.id) {
      return server.ownerId === currentUser.id;
    }
    const username = currentUser.username?.toLowerCase();
    const email = currentUser.email?.toLowerCase();
    const owner = server.owner?.toLowerCase();
    const ownerEmail = server.ownerEmail?.toLowerCase();

    // If server has no owner set, treat as own for non-admin clients
    if (!owner && !ownerEmail) return true;
    return (owner && owner === username) || Boolean(ownerEmail && email && ownerEmail === email);
  };

  const myServersCount = servers.filter(isMyServer).length;
  const otherServersCount = servers.filter((s) => !isMyServer(s)).length;

  // Ownership filter: 'mine' | 'others' | 'all'
  const [ownershipFilter, setOwnershipFilter] = useState<'mine' | 'others' | 'all'>('mine');
  const [statusFilter, setStatusFilter] = useState<ServerStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Multi-Server Bulk Actions State
  const [isBulkMode, setIsBulkMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionRunning, setBulkActionRunning] = useState<PowerAction | null>(null);

  const filteredServers = servers.filter((server) => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.egg.toLowerCase().includes(searchQuery.toLowerCase()) ||
      server.allocation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (server.owner && server.owner.toLowerCase().includes(searchQuery.toLowerCase())) ||
      server.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' ? true : server.status === statusFilter;

    const matchesCategory =
      categoryFilter === 'all' ? true : server.category === categoryFilter;

    const isMine = isMyServer(server);
    const matchesOwnership =
      ownershipFilter === 'all'
        ? true
        : ownershipFilter === 'mine'
        ? isMine
        : !isMine;

    return matchesSearch && matchesStatus && matchesCategory && matchesOwnership;
  });

  const categories = ['all', 'Gaming', 'Database', 'Applications'];

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

  const toggleSelectServer = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredServers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredServers.map((s) => s.id));
    }
  };

  const executeBulk = async (action: PowerAction) => {
    if (selectedIds.length === 0 || bulkActionRunning) return;
    try {
      setBulkActionRunning(action);
      await bulkPowerAction(selectedIds, action);
    } finally {
      setBulkActionRunning(null);
    }
  };

  return (
    <div className="space-y-6 relative pb-16">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]/80">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight flex items-center gap-2">
              <span>
                {ownershipFilter === 'mine'
                  ? (isDe ? 'Meine Server' : 'My Servers')
                  : ownershipFilter === 'others'
                  ? (isDe ? 'Server von anderen' : 'Shared Servers')
                  : (isDe ? 'Alle Server' : 'All Server Instances')}
              </span>
              <span className="text-xs font-mono text-slate-400 bg-[#161b22] px-2.5 py-0.5 rounded-full border border-[#30363d]">
                {filteredServers.length}
              </span>
            </h1>
            {isBulkMode && (
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold animate-pulse">
                Bulk Mode Active
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {isLoadingServers
              ? 'Loading active instances from cluster...'
              : ownershipFilter === 'mine'
              ? (isDe ? 'Verwalte deine zugewiesenen Server & Workloads' : 'Manage your dedicated servers and workloads')
              : ownershipFilter === 'others'
              ? (isDe ? 'Server und Instanzen, die von anderen Nutzern freigegeben wurden' : 'Instances shared with you by other project owners')
              : (isDe ? 'Vollständige Übersicht aller zugewiesenen und freigegebenen Server' : 'Complete overview of all instances across the cluster')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Multi Server Bulk Access Toggle */}
          <button
            onClick={() => {
              setIsBulkMode((prev) => !prev);
              if (isBulkMode) setSelectedIds([]);
            }}
            className={`btn px-3 py-2 text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all ${
              isBulkMode
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                : 'btn-secondary text-slate-300 hover:text-white border-[#30363d]'
            }`}
            title="Toggle Multi-Server Selection"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isBulkMode ? 'Exit Bulk' : 'Bulk Actions'}</span>
          </button>

          {/* View mode toggle */}
          <div className="hidden sm:flex items-center bg-[#161b22] border border-[#30363d] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-[#21262d] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded transition-colors ${
                viewMode === 'table'
                  ? 'bg-[#21262d] text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn btn-secondary px-3.5 py-2 text-xs font-semibold shadow-sm flex items-center gap-1.5 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Import Project</span>
          </button>

          <button
            onClick={() => setIsCreateServerOpen(true)}
            className="btn btn-primary px-3.5 py-2 text-xs font-semibold shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy Instance</span>
          </button>
        </div>
      </div>

      {/* Ownership Segmented Filter: Eigene Server vs Server von anderen vs Alle */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 bg-[#161b22] border border-[#30363d] rounded-2xl">
        <div className="flex items-center gap-1.5 p-1 bg-[#0d1117] border border-[#30363d]/80 rounded-xl">
          <button
            type="button"
            onClick={() => setOwnershipFilter('mine')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              ownershipFilter === 'mine'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isDe ? 'Eigene Server' : 'My Servers'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              ownershipFilter === 'mine' ? 'bg-indigo-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {myServersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOwnershipFilter('others')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              ownershipFilter === 'others'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>{isDe ? 'Server von anderen' : 'Shared with Me'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              ownershipFilter === 'others' ? 'bg-purple-700 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {otherServersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setOwnershipFilter('all')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${
              ownershipFilter === 'all'
                ? 'bg-slate-700 text-white font-bold shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <ServerIcon className="w-3.5 h-3.5 text-slate-300" />
            <span>{isDe ? 'Alle Server' : 'All Servers'}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              ownershipFilter === 'all' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {servers.length}
            </span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-mono px-2">
          {ownershipFilter === 'mine' && (isDe ? 'Zeigt nur Server, deren Eigentümer du bist' : 'Showing servers owned by your account')}
          {ownershipFilter === 'others' && (isDe ? 'Zeigt geteilte Server und Gast-Instanzen' : 'Showing shared or guest instances')}
          {ownershipFilter === 'all' && (isDe ? 'Gesamte Flottenübersicht' : 'Complete fleet overview')}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#161b22] rounded-xl p-4 border border-[#30363d] space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by server name, egg, IP port, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Category Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize whitespace-nowrap ${
                  categoryFilter === cat
                    ? 'bg-[#21262d] text-white border border-[#30363d]'
                    : 'bg-[#0d1117] text-slate-400 hover:text-white border border-[#30363d]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filters & Bulk Select All */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pt-2 border-t border-[#30363d]/80">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1 font-mono">
              <Filter className="w-3 h-3 text-slate-400" /> Status:
            </span>

            {[
              { id: 'all', label: 'All' },
              { id: 'running', label: 'Running' },
              { id: 'starting', label: 'Starting' },
              { id: 'stopped', label: 'Stopped' },
              { id: 'offline', label: 'Offline' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setStatusFilter(item.id as any)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors whitespace-nowrap ${
                  statusFilter === item.id
                    ? 'bg-[#21262d] text-white font-medium border border-[#30363d]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {isBulkMode && filteredServers.length > 0 && (
            <button
              onClick={handleSelectAll}
              className="text-xs font-mono text-indigo-300 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors whitespace-nowrap ml-auto"
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>
                {selectedIds.length === filteredServers.length
                  ? 'Deselect All'
                  : `Select All (${filteredServers.length})`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Server Listing: Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoadingServers ? (
            <ServerCardSkeleton count={6} />
          ) : (
            filteredServers.map((server) => (
              <ServerCard
                key={server.id}
                server={server}
                isBulkMode={isBulkMode}
                isSelected={selectedIds.includes(server.id)}
                onToggleSelect={() => toggleSelectServer(server.id)}
              />
            ))
          )}
        </div>
      ) : (
        /* Table View */
        <div className="bg-[#161b22] rounded-xl border border-[#30363d] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#161b22] text-slate-400 border-b border-[#30363d] font-medium">
                <tr>
                  {isBulkMode && <th className="py-3 px-4 w-10">Select</th>}
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Instance / Egg</th>
                  <th className="py-3 px-4">Node & Allocation</th>
                  <th className="py-3 px-4">CPU Usage</th>
                  <th className="py-3 px-4">Memory</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]/70">
                {isLoadingServers ? (
                  <ServerTableRowSkeleton rows={5} />
                ) : (
                  filteredServers.map((server) => {
                    const isSelected = selectedIds.includes(server.id);
                    const pendingAction = pendingPowerActions[server.id];

                    return (
                      <tr
                        key={server.id}
                        onClick={() => {
                          if (isBulkMode) {
                            toggleSelectServer(server.id);
                          } else {
                            selectServerAndNavigate(server, 'console');
                          }
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-500/10 hover:bg-indigo-500/15'
                            : 'hover:bg-[#1c2128]'
                        }`}
                      >
                        {isBulkMode && (
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <div
                              onClick={() => toggleSelectServer(server.id)}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-500 text-white'
                                  : 'border-[#30363d] bg-[#0d1117] hover:border-slate-500'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>
                          </td>
                        )}
                        <td className="py-3.5 px-4">
                          <StatusBadge status={server.status} size="sm" />
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-white truncate max-w-[200px]">
                            {server.name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-mono">{server.egg}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => handleCopyIp(e, server.allocation, server.id)}
                              className="flex items-center gap-1 text-[11px] font-mono text-slate-300 bg-[#0d1117] hover:bg-[#21262d] px-2 py-0.5 rounded border border-[#30363d] transition-colors"
                            >
                              <Globe className="w-3 h-3 text-slate-400" />
                              <span>{server.allocation}</span>
                              {copiedId === server.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-500" />
                              )}
                            </button>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">{server.node}</p>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-mono text-slate-200">
                            {server.stats.cpu}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">
                          <span className="text-slate-300">
                            {(server.stats.memory / 1024).toFixed(1)} /{' '}
                            {(server.stats.memoryLimit / 1024).toFixed(0)} GB
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              selectServerAndNavigate(server, 'console');
                            }}
                            className="p-1.5 rounded-md bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white border border-[#30363d] transition-colors"
                          >
                            <Terminal className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoadingServers && filteredServers.length === 0 && (
        <div className="py-16 text-center bg-[#161b22] rounded-xl border border-[#30363d]">
          <ServerIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">
            {ownershipFilter === 'others'
              ? isDe
                ? 'Keine Server von anderen Benutzern freigegeben'
                : 'No servers from other users found'
              : isDe
              ? 'Keine Server gefunden'
              : 'No servers found'}
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {ownershipFilter === 'others'
              ? isDe
                ? 'Aktuell wurden dir keine Server von anderen Benutzern freigegeben.'
                : 'No shared servers or instances from other users are currently available.'
              : isDe
              ? 'Keine Server entsprechen deinen aktuellen Filtern.'
              : 'No servers matched your current filter query.'}
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('all');
              setCategoryFilter('all');
              setOwnershipFilter('all');
            }}
            className="mt-4 px-3.5 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-xs text-slate-300 border border-[#30363d] transition-colors"
          >
            {isDe ? 'Filter zurücksetzen' : 'Reset Filters'}
          </button>
        </div>
      )}

      {/* Floating Multi-Server Bulk Action Bar */}
      {isBulkMode && selectedIds.length > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="bg-[#161b22]/95 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-3 shadow-2xl flex items-center gap-3 max-w-2xl w-full justify-between">
            <div className="flex items-center gap-2.5 pl-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
              <span className="text-xs font-semibold text-white font-mono">
                {selectedIds.length} server(s) selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => executeBulk('start')}
                disabled={Boolean(bulkActionRunning)}
                className="btn px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {bulkActionRunning === 'start' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Start</span>
              </button>

              <button
                onClick={() => executeBulk('restart')}
                disabled={Boolean(bulkActionRunning)}
                className="btn px-3 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {bulkActionRunning === 'restart' ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCw className="w-3.5 h-3.5" />
                )}
                <span>Restart</span>
              </button>

              <button
                onClick={() => executeBulk('stop')}
                disabled={Boolean(bulkActionRunning)}
                className="btn px-3 py-1.5 text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {bulkActionRunning === 'stop' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Square className="w-3.5 h-3.5 fill-current" />
                )}
                <span>Stop</span>
              </button>

              <button
                onClick={() => setSelectedIds([])}
                className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-400 hover:text-white transition-colors ml-1"
                title="Deselect All"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
