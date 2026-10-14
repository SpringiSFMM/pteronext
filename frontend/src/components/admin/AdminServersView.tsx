import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Server, ServerStatus } from '../../types';
import {
  Server as ServerIcon,
  Search,
  Filter,
  Sliders,
  Terminal,
  Trash2,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  HardDrive,
  Cpu,
  Layers,
  Users,
  Copy,
  Check,
  Plus,
  Download,
  AlertTriangle,
  ExternalLink,
  Shield,
  Clock,
  ChevronRight,
  Database,
  Archive,
  Zap,
} from 'lucide-react';
import { Modal } from '../common/Modal';

export const AdminServersView: React.FC = () => {
  const {
    servers,
    adminNodes,
    adminUsers,
    adminEggs,
    selectServerAndNavigate,
    updateServerAdminSettings,
    deleteServer,
    toggleServerSuspension,
    reinstallServer,
    setIsCreateServerOpen,
    setIsImportModalOpen,
    addToast,
  } = useApp();

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [nodeFilter, setNodeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [deletingServer, setDeletingServer] = useState<Server | null>(null);
  const [adminDeletePassword, setAdminDeletePassword] = useState('');
  const [adminDeletePasswordError, setAdminDeletePasswordError] = useState('');
  const [reinstallingServer, setReinstallingServer] = useState<Server | null>(null);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editOwner, setEditOwner] = useState('');
  const [editMemory, setEditMemory] = useState(2048);
  const [editCpu, setEditCpu] = useState(200);
  const [editDisk, setEditDisk] = useState(10240);
  const [editSwap, setEditSwap] = useState(0);
  const [editIo, setEditIo] = useState(500);
  const [editStartup, setEditStartup] = useState('');
  const [editDockerImage, setEditDockerImage] = useState('');
  const [editDatabases, setEditDatabases] = useState(2);
  const [editBackups, setEditBackups] = useState(3);
  const [editAllocations, setEditAllocations] = useState(1);
  const [editSuspended, setEditSuspended] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    addToast({
      title: 'Copied to Clipboard',
      description: text,
      type: 'info',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenEdit = (server: Server) => {
    setEditingServer(server);
    setEditName(server.name);
    setEditDesc(server.description || '');
    setEditOwner(server.owner || 'admin');
    setEditMemory(server.stats.memoryLimit || 2048);
    setEditCpu(server.cpuLimit || server.stats.cpu || 200);
    setEditDisk(server.stats.diskLimit || 10240);
    setEditSwap(server.swapLimit ?? 0);
    setEditIo(server.ioLimit ?? 500);
    setEditStartup(server.startup || '');
    setEditDockerImage(server.dockerImage || '');
    setEditDatabases(server.databasesLimit ?? 2);
    setEditBackups(server.backupsLimit ?? 3);
    setEditAllocations(server.allocationsLimit ?? 1);
    setEditSuspended(Boolean(server.isSuspended));
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer) return;
    setIsSubmitting(true);
    const success = await updateServerAdminSettings(editingServer.uuid || editingServer.id, {
      name: editName.trim(),
      description: editDesc.trim(),
      owner: editOwner,
      memoryMB: Number(editMemory),
      cpuLimit: Number(editCpu),
      diskMB: Number(editDisk),
      swapLimit: Number(editSwap),
      ioLimit: Number(editIo),
      startup: editStartup,
      dockerImage: editDockerImage,
      databasesLimit: Number(editDatabases),
      backupsLimit: Number(editBackups),
      allocationsLimit: Number(editAllocations),
      isSuspended: editSuspended,
    });
    setIsSubmitting(false);
    if (success) {
      setEditingServer(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingServer) return;
    if (!adminDeletePassword) {
      setAdminDeletePasswordError('Bitte gib dein Account-Passwort ein.');
      return;
    }
    const ok = await deleteServer(deletingServer.id, adminDeletePassword);
    if (ok) {
      setDeletingServer(null);
      setAdminDeletePassword('');
      setAdminDeletePasswordError('');
    } else {
      setAdminDeletePasswordError('Falsches Account-Passwort oder Löschfehler.');
    }
  };

  const handleConfirmReinstall = async () => {
    if (!reinstallingServer) return;
    await reinstallServer(reinstallingServer.id);
    setReinstallingServer(null);
  };

  // Filtered servers
  const filteredServers = useMemo(() => {
    return servers.filter((srv) => {
      const matchSearch =
        search === '' ||
        srv.name.toLowerCase().includes(search.toLowerCase()) ||
        srv.uuid.toLowerCase().includes(search.toLowerCase()) ||
        (srv.owner && srv.owner.toLowerCase().includes(search.toLowerCase())) ||
        srv.allocation.toLowerCase().includes(search.toLowerCase());

      const matchNode = nodeFilter === 'all' || srv.node === nodeFilter;

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'suspended' && srv.isSuspended) ||
        (statusFilter === 'running' && !srv.isSuspended && srv.status === 'running') ||
        (statusFilter === 'offline' && !srv.isSuspended && (srv.status === 'stopped' || srv.status === 'offline'));

      return matchSearch && matchNode && matchStatus;
    });
  }, [servers, search, nodeFilter, statusFilter]);

  // Aggregate stats
  const totalAllocatedRamMB = servers.reduce((acc, s) => acc + (s.stats.memoryLimit || 1024), 0);
  const totalAllocatedDiskMB = servers.reduce((acc, s) => acc + (s.stats.diskLimit || 5120), 0);
  const runningCount = servers.filter((s) => s.status === 'running' && !s.isSuspended).length;
  const suspendedCount = servers.filter((s) => s.isSuspended).length;

  return (
    <div className="space-y-6 view-enter">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
              Cluster Infrastructure
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Cluster Server Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Global container directory, hardware quotas, runtime ownership, and direct operational overrides.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn btn-secondary px-3.5 py-2 font-medium text-xs shadow-sm flex items-center gap-1.5 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/10"
          >
            <Download className="w-4 h-4 text-indigo-400" />
            <span>Pterodactyl / Pelican / Hydrodactyl Import</span>
          </button>
          <button
            onClick={() => setIsCreateServerOpen(true)}
            className="btn btn-primary px-4 py-2 font-medium text-xs shadow-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy New Server</span>
          </button>
        </div>
      </div>

      {/* Cluster Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[#11141a] border border-[#30363d] space-y-1">
          <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
            Total Containers
          </span>
          <div className="text-lg font-bold text-white font-mono flex items-center justify-between">
            <span>{servers.length}</span>
            <ServerIcon className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            Across {adminNodes.length} active node{adminNodes.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#11141a] border border-[#30363d] space-y-1">
          <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
            Online Containers
          </span>
          <div className="text-lg font-bold text-emerald-400 font-mono flex items-center justify-between">
            <span>{runningCount}</span>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            {((runningCount / Math.max(1, servers.length)) * 100).toFixed(0)}% runtime availability
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#11141a] border border-[#30363d] space-y-1">
          <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
            RAM Allocation
          </span>
          <div className="text-lg font-bold text-white font-mono flex items-center justify-between">
            <span>{(totalAllocatedRamMB / 1024).toFixed(1)} GB</span>
            <Cpu className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-[11px] text-slate-400 font-mono">Total committed memory</p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#11141a] border border-[#30363d] space-y-1">
          <span className="text-[10px] uppercase font-mono text-slate-500 tracking-wider">
            Suspended / Locked
          </span>
          <div className="text-lg font-bold text-amber-400 font-mono flex items-center justify-between">
            <span>{suspendedCount}</span>
            <PauseCircle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-[11px] text-slate-400 font-mono">Administratively locked</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-xl bg-[#11141a] border border-[#30363d] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search servers by name, UUID, owner, or allocation..."
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Node Filter */}
          <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#30363d] rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={nodeFilter}
              onChange={(e) => setNodeFilter(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="all">All Nodes</option>
              {adminNodes.map((n) => (
                <option key={n.id} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#0d1117] border border-[#30363d] rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="running">Online Only</option>
              <option value="offline">Offline Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Server Table */}
      <div className="rounded-xl bg-[#11141a] border border-[#30363d] overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#30363d] bg-[#0c1017] text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-4">Server & Identifier</th>
                <th className="py-3 px-4">Node & Allocation</th>
                <th className="py-3 px-4">Assigned Owner</th>
                <th className="py-3 px-4">Hardware Limits</th>
                <th className="py-3 px-4">Operational Status</th>
                <th className="py-3 px-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2530]">
              {filteredServers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                    No matching servers found matching your query.
                  </td>
                </tr>
              ) : (
                filteredServers.map((srv) => {
                  const isRunning = srv.status === 'running' && !srv.isSuspended;
                  const isSuspended = Boolean(srv.isSuspended);

                  return (
                    <tr
                      key={srv.id}
                      className="hover:bg-[#141923] transition-colors group"
                    >
                      {/* Name & UUID */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-lg bg-[#0d1117] border border-[#2b3342] text-slate-300 group-hover:border-zinc-500 transition-colors shrink-0">
                            <ServerIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                onClick={() => selectServerAndNavigate(srv, 'console')}
                                className="font-semibold text-white hover:underline cursor-pointer truncate"
                              >
                                {srv.name}
                              </span>
                              {srv.category && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/10 hidden sm:inline-block">
                                  {srv.category}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mt-0.5">
                              <span className="truncate">{srv.uuid.slice(0, 8)}...</span>
                              <button
                                onClick={() => copyToClipboard(srv.uuid, srv.id)}
                                className="hover:text-white"
                                title="Copy Full UUID"
                              >
                                {copiedId === srv.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3 text-slate-500" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Node & Allocation */}
                      <td className="py-3.5 px-4 min-w-[160px]">
                        <div className="font-mono text-xs">
                          <div className="flex items-center gap-1.5 text-slate-200">
                            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                            <span className="truncate">{srv.node}</span>
                          </div>
                          <span className="text-[11px] text-zinc-400 block mt-0.5 truncate">
                            {srv.allocation}
                          </span>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-4 min-w-[140px]">
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                            {(srv.owner || 'A')[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <span className="text-white block truncate">{srv.owner || 'admin'}</span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              {srv.ownerEmail || `${srv.owner || 'admin'}@panel.local`}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Hardware Limits */}
                      <td className="py-3.5 px-4 min-w-[160px] font-mono text-xs">
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-slate-300">
                            <span>RAM:</span>
                            <span className="text-white font-bold">
                              {(srv.stats.memoryLimit / 1024).toFixed(1)} GB
                            </span>
                          </div>
                          <div className="flex justify-between text-slate-400 text-[11px]">
                            <span>CPU:</span>
                            <span>{srv.stats.cpu || 200}%</span>
                          </div>
                          <div className="flex justify-between text-slate-400 text-[11px]">
                            <span>Disk:</span>
                            <span>{(srv.stats.diskLimit / 1024).toFixed(0)} GB</span>
                          </div>
                        </div>
                      </td>

                      {/* Operational Status */}
                      <td className="py-3.5 px-4 min-w-[130px]">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <PauseCircle className="w-3 h-3" />
                            <span>Suspended</span>
                          </span>
                        ) : isRunning ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Online</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            <span>Stopped</span>
                          </span>
                        )}
                      </td>

                      {/* Admin Actions */}
                      <td className="py-3.5 px-4 text-right min-w-[180px]">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Console Quick Jump */}
                          <button
                            onClick={() => selectServerAndNavigate(srv, 'console')}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                            title="Open Server Console"
                          >
                            <Terminal className="w-4 h-4" />
                          </button>

                          {/* Edit Settings Modal */}
                          <button
                            onClick={() => handleOpenEdit(srv)}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            title="Edit Server Limits & Config"
                          >
                            <Sliders className="w-4 h-4" />
                          </button>

                          {/* Suspend / Unsuspend */}
                          <button
                            onClick={() => toggleServerSuspension(srv.id)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isSuspended
                                ? 'text-amber-400 hover:bg-amber-500/10'
                                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
                            }`}
                            title={isSuspended ? 'Unsuspend Server' : 'Suspend Server'}
                          >
                            {isSuspended ? (
                              <PlayCircle className="w-4 h-4" />
                            ) : (
                              <PauseCircle className="w-4 h-4" />
                            )}
                          </button>

                          {/* Reinstall Container */}
                          <button
                            onClick={() => setReinstallingServer(srv)}
                            className="p-1.5 text-slate-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                            title="Reinstall Container"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>

                          {/* Delete Server */}
                          <button
                            onClick={() => setDeletingServer(srv)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete Server"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Admin Edit Server Settings Modal ── */}
      {editingServer && (
        <Modal
          isOpen={Boolean(editingServer)}
          onClose={() => setEditingServer(null)}
          title={`Edit Server: ${editingServer.name}`}
          subtitle={`UUID: ${editingServer.uuid} • Node: ${editingServer.node}`}
          icon={<Sliders className="w-4 h-4 text-zinc-300" />}
          badge="SERVER CONFIG"
          badgeColor="default"
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-5 text-xs font-mono">
            {/* General Info */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block border-b border-[#212836] pb-1">
                1. Identity & Assigned Ownership
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Server Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Assigned Owner *
                  </label>
                  <select
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  >
                    {adminUsers.map((u) => (
                      <option key={u.id} value={u.username}>
                        {u.username} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-300 mb-1 font-sans">
                  Server Description
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Optional container notes or customer tag"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none font-sans"
                />
              </div>
            </div>

            {/* Hardware Limits */}
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block border-b border-[#212836] pb-1">
                2. Hardware Quotas & Allocation Limits
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Memory Limit (MB) *</label>
                  <input
                    type="number"
                    min={256}
                    step={128}
                    required
                    value={editMemory}
                    onChange={(e) => setEditMemory(Number(e.target.value))}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    = {(editMemory / 1024).toFixed(1)} GB RAM
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">CPU Limit (%) *</label>
                  <input
                    type="number"
                    min={50}
                    step={50}
                    required
                    value={editCpu}
                    onChange={(e) => setEditCpu(Number(e.target.value))}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    = {(editCpu / 100).toFixed(1)} Cores
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">Disk Limit (MB) *</label>
                  <input
                    type="number"
                    min={1024}
                    step={1024}
                    required
                    value={editDisk}
                    onChange={(e) => setEditDisk(Number(e.target.value))}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    = {(editDisk / 1024).toFixed(0)} GB SSD
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Swap Space (MB)</label>
                  <input
                    type="number"
                    min={0}
                    step={512}
                    value={editSwap}
                    onChange={(e) => setEditSwap(Number(e.target.value))}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Block IO Weight (10-1000)</label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={editIo}
                    onChange={(e) => setEditIo(Number(e.target.value))}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Feature Limits & Status */}
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider block border-b border-[#212836] pb-1">
                3. Feature Limits & Administrative Lock
              </span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Databases</label>
                  <input
                    type="number"
                    min={0}
                    value={editDatabases}
                    onChange={(e) => setEditDatabases(Number(e.target.value))}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Backups</label>
                  <input
                    type="number"
                    min={0}
                    value={editBackups}
                    onChange={(e) => setEditBackups(Number(e.target.value))}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Extra Ports</label>
                  <input
                    type="number"
                    min={0}
                    value={editAllocations}
                    onChange={(e) => setEditAllocations(Number(e.target.value))}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Suspension Checkbox */}
              <label className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:bg-amber-500/15 transition-colors">
                <input
                  type="checkbox"
                  checked={editSuspended}
                  onChange={(e) => setEditSuspended(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 border-amber-600 bg-[#0d1117]"
                />
                <div className="min-w-0">
                  <span className="text-xs font-bold text-amber-300 block">
                    Server Suspended (Administrative Lock)
                  </span>
                  <span className="text-[11px] text-amber-400/80 block font-sans">
                    Prevents the user from starting the container and stops active workloads.
                  </span>
                </div>
              </label>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#212836]">
              <button
                type="button"
                onClick={() => setEditingServer(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary px-5 py-2 rounded-xl text-xs font-bold transition-all"
              >
                {isSubmitting ? 'Saving Changes...' : 'Save Server Settings'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deletingServer && (
        <Modal
          isOpen={Boolean(deletingServer)}
          onClose={() => setDeletingServer(null)}
          title={`Delete Server: ${deletingServer.name}`}
          subtitle="Permanent container removal and quota reclamation"
          icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
          badge="DESTRUCTIVE"
          badgeColor="rose"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-2">
              <p className="font-sans font-medium text-slate-200">
                You are about to permanently delete server{' '}
                <strong className="text-white">"{deletingServer.name}"</strong> (
                <code>{deletingServer.uuid}</code>).
              </p>
              <p className="text-[11px] text-slate-400 font-sans">
                This will terminate the Wings container, erase all files and databases, and free
                port {deletingServer.allocation}.
              </p>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-sans font-semibold text-slate-300 block">
                Account-Passwort zur Bestätigung:
              </label>
              <input
                type="password"
                value={adminDeletePassword}
                onChange={(e) => setAdminDeletePassword(e.target.value)}
                placeholder="Dein Account-Passwort eingeben"
                className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-slate-700 focus:border-rose-500 text-white font-mono text-xs focus:outline-none transition-colors"
                autoFocus
              />
              {adminDeletePasswordError && (
                <p className="text-[11px] text-rose-400 font-sans font-semibold">{adminDeletePasswordError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#212836]">
              <button
                type="button"
                onClick={() => setDeletingServer(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition-all shadow-[0_0_12px_rgba(225,29,72,0.3)]"
              >
                Confirm Delete Server
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Reinstall Confirmation Modal ── */}
      {reinstallingServer && (
        <Modal
          isOpen={Boolean(reinstallingServer)}
          onClose={() => setReinstallingServer(null)}
          title={`Reinstall Server: ${reinstallingServer.name}`}
          subtitle="Re-run container installation script"
          icon={<RotateCcw className="w-4 h-4 text-purple-400" />}
          badge="REINSTALL"
          badgeColor="purple"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs font-mono">
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 space-y-2">
              <p className="font-sans font-medium text-slate-200">
                Reinstalling the container will re-execute the Egg installation script for{' '}
                <strong className="text-white">"{reinstallingServer.name}"</strong>.
              </p>
              <p className="text-[11px] text-slate-400 font-sans">
                Existing config files may be overwritten depending on the Egg deploy script.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#212836]">
              <button
                type="button"
                onClick={() => setReinstallingServer(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReinstall}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all"
              >
                Initiate Reinstall
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default AdminServersView;
