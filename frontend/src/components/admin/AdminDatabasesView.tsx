import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Database,
  Server,
  HardDrive,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  Shield,
  Layers,
  Check,
  Copy,
  AlertTriangle,
  Activity,
  Cpu,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { useTranslation } from '../../i18n/useTranslation';

export const AdminDatabasesView: React.FC = () => {
  const {
    adminDatabaseHosts,
    adminGlobalDatabases,
    adminNodes,
    createDatabaseHost,
    deleteDatabaseHost,
    refreshAdminDatabases,
    addToast,
  } = useApp();
  const { language } = useTranslation();

  const [activeTab, setActiveTab] = useState<'hosts' | 'databases'>('hosts');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddHostOpen, setIsAddHostOpen] = useState(false);
  const [deleteTargetHost, setDeleteTargetHost] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingHost, setIsDeletingHost] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // New Host Form State
  const [hostName, setHostName] = useState('');
  const [hostAddress, setHostAddress] = useState('127.0.0.1');
  const [hostPort, setHostPort] = useState(3306);
  const [hostUsername, setHostUsername] = useState('pterodactyl');
  const [hostPassword, setHostPassword] = useState('');
  const [hostNodeId, setHostNodeId] = useState<number | undefined>(undefined);
  const [hostMaxDbs, setHostMaxDbs] = useState<number | undefined>(50);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCopy = (text: string, key: string, label: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    addToast({
      title: 'Copied',
      description: `Copied ${label} to clipboard`,
      type: 'info',
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshAdminDatabases();
      addToast({
        title: 'Databases Synchronized',
        description: 'Loaded latest hosts and databases from cluster.',
        type: 'info',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateHost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostName.trim() || !hostAddress.trim() || !hostUsername.trim()) {
      addToast({
        title: 'Missing Required Fields',
        description: 'Please fill in the host name, address, and username.',
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await createDatabaseHost({
        name: hostName.trim(),
        host: hostAddress.trim(),
        port: hostPort || 3306,
        username: hostUsername.trim(),
        password: hostPassword || undefined,
        node_id: hostNodeId,
        max_databases: hostMaxDbs,
      });

      if (success) {
        setIsAddHostOpen(false);
        setHostName('');
        setHostAddress('127.0.0.1');
        setHostPort(3306);
        setHostUsername('pterodactyl');
        setHostPassword('');
        setHostNodeId(undefined);
        setHostMaxDbs(50);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteHost = (id: string, name: string) => {
    setDeleteTargetHost({ id, name });
  };

  const handleConfirmDeleteHost = async () => {
    if (!deleteTargetHost) return;
    setIsDeletingHost(true);
    try {
      await deleteDatabaseHost(deleteTargetHost.id);
      setDeleteTargetHost(null);
    } finally {
      setIsDeletingHost(false);
    }
  };

  // Filtered Databases
  const filteredDatabases = adminGlobalDatabases.filter((db) => {
    const q = searchQuery.toLowerCase();
    return (
      db.name.toLowerCase().includes(q) ||
      db.username.toLowerCase().includes(q) ||
      String(db.serverId).includes(q) ||
      (db.host?.name && db.host.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Database Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Manage relational database servers, cluster hosts, and tenant database instances
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>

          <button
            onClick={() => setIsAddHostOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold font-mono transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Host</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
              Database Hosts
            </span>
            <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 flex items-center justify-center">
              <Server className="w-4 h-4 text-zinc-300" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-2">
            {adminDatabaseHosts.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Active MySQL / MariaDB instances</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
              Global Databases
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-2">
            {adminGlobalDatabases.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Tenant schemas created</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
              Nodes Connected
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white font-mono mt-2">
            {adminNodes.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Wings cluster compute nodes</p>
        </div>

        <div className="p-4 rounded-2xl bg-[#161b22] border border-[#30363d] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
              Health Status
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 font-mono mt-2">
            Operational
          </p>
          <p className="text-xs text-slate-500 mt-1">All database listeners healthy</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-[#30363d]">
        <button
          onClick={() => setActiveTab('hosts')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px ${
            activeTab === 'hosts'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Database Hosts ({adminDatabaseHosts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('databases')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all -mb-px ${
            activeTab === 'databases'
              ? 'border-white text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>All Databases ({adminGlobalDatabases.length})</span>
        </button>
      </div>

      {/* Tab: Hosts */}
      {activeTab === 'hosts' && (
        <div className="space-y-4">
          {adminDatabaseHosts.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl bg-[#161b22] border border-[#30363d]">
              <Database className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">No Database Hosts Configured</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-5">
                Register a MySQL or MariaDB host to allow game servers to automatically provision
                databases and credentials.
              </p>
              <button
                onClick={() => setIsAddHostOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold font-mono transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Host</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminDatabaseHosts.map((host) => {
                const max = host.maxDatabases || 0;
                const count = host.databaseCount || 0;
                const usagePercent = max > 0 ? Math.min(100, Math.round((count / max) * 100)) : 0;
                const nodeMatch = adminNodes.find((n) => n.id === String(host.nodeId));

                return (
                  <div
                    key={host.id}
                    className="p-5 rounded-2xl bg-[#161b22] border border-[#30363d] hover:border-[#484f58] transition-all space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-white tracking-wide">{host.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[11px] text-emerald-400 font-mono">Online</span>
                            {nodeMatch && (
                              <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-[#21262d] border border-[#30363d]">
                                Node: {nodeMatch.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteHost(host.id, host.name)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Delete Host"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Endpoint Box */}
                      <div className="p-3 bg-[#0d1117] rounded-xl border border-[#30363d] flex items-center justify-between text-xs font-mono">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] text-slate-500 block uppercase">Endpoint</span>
                          <span className="text-zinc-200 truncate block">
                            {host.host}:{host.port}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            handleCopy(`${host.host}:${host.port}`, `endpoint-${host.id}`, 'Endpoint')
                          }
                          className="text-slate-400 hover:text-white p-1"
                        >
                          {copiedKey === `endpoint-${host.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      {/* Credentials */}
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2 bg-[#0d1117] rounded-lg border border-[#30363d]/60">
                          <span className="text-[10px] text-slate-500 block uppercase">Username</span>
                          <span className="text-slate-200 truncate block">{host.username}</span>
                        </div>
                        <div className="p-2 bg-[#0d1117] rounded-lg border border-[#30363d]/60">
                          <span className="text-[10px] text-slate-500 block uppercase">Databases</span>
                          <span className="text-slate-200 font-semibold">
                            {count} {max > 0 ? `/ ${max}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Quota Progress */}
                      {max > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono text-slate-400">
                            <span>Capacity</span>
                            <span>{usagePercent}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#0d1117] overflow-hidden">
                            <div
                              className="h-full bg-zinc-300 rounded-full transition-all"
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#30363d]/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span>ID #{host.id}</span>
                      <span>Default User Management</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: All Databases */}
      {activeTab === 'databases' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by database name, username, server ID..."
                className="w-full bg-[#161b22] border border-[#30363d] focus:border-zinc-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-[#161b22] border border-[#30363d] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#30363d] bg-[#0d1117]/50 font-mono text-[11px] text-slate-400 uppercase">
                    <th className="py-3 px-4 font-medium">Database Name</th>
                    <th className="py-3 px-4 font-medium">Server ID</th>
                    <th className="py-3 px-4 font-medium">Database Host</th>
                    <th className="py-3 px-4 font-medium">Username</th>
                    <th className="py-3 px-4 font-medium">Remote Access</th>
                    <th className="py-3 px-4 font-medium">Max Conns</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d]">
                  {filteredDatabases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500">
                        No databases found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredDatabases.map((db) => (
                      <tr key={db.id} className="hover:bg-[#1c2128] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-white flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                          <span>{db.name}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d]">
                            Server #{db.serverId}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">
                          {db.host ? `${db.host.name} (${db.host.host}:${db.host.port})` : `Host #${db.databaseHostId}`}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">{db.username}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                            {db.remote}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-400">
                          {db.maxConnections === 0 ? 'Unlimited' : db.maxConnections}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Database Host Modal */}
      <Modal
        isOpen={isAddHostOpen}
        onClose={() => setIsAddHostOpen(false)}
        title="Add Database Host"
        subtitle="Register an external MySQL / MariaDB host to automate database provisioning"
        icon={<Database className="w-4 h-4 text-zinc-300" />}
        badge="CLUSTER HOST"
        badgeColor="default"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateHost} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Host Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Primary MySQL 8.0"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
                required
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[var(--theme-accent,#e5a93c)] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Host FQDN or IP *
              </label>
              <input
                type="text"
                placeholder="127.0.0.1 or db.example.com"
                value={hostAddress}
                onChange={(e) => setHostAddress(e.target.value)}
                required
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[var(--theme-accent,#e5a93c)] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Port *
              </label>
              <input
                type="number"
                value={hostPort}
                onChange={(e) => setHostPort(parseInt(e.target.value) || 3306)}
                required
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[var(--theme-accent,#e5a93c)] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Username *
              </label>
              <input
                type="text"
                placeholder="pterodactyl"
                value={hostUsername}
                onChange={(e) => setHostUsername(e.target.value)}
                required
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[var(--theme-accent,#e5a93c)] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={hostPassword}
                onChange={(e) => setHostPassword(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[var(--theme-accent,#e5a93c)] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Linked Node (Optional)
              </label>
              <select
                value={hostNodeId || ''}
                onChange={(e) => setHostNodeId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[var(--theme-accent,#e5a93c)] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
              >
                <option value="">Global / Any Node</option>
                {adminNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.fqdn})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Max Databases Limit
              </label>
              <input
                type="number"
                placeholder="50 (leave empty for unlimited)"
                value={hostMaxDbs || ''}
                onChange={(e) => setHostMaxDbs(e.target.value ? parseInt(e.target.value) : undefined)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-[var(--theme-accent,#e5a93c)] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="p-3 bg-white/[0.03] rounded-xl border border-white/10 text-xs text-slate-400">
            <span className="text-zinc-200 font-semibold font-mono block mb-0.5">Automated User Creation</span>
            The panel user configured above must have GRANT ALL privileges with WITH GRANT OPTION to allow creating per-server databases.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              onClick={() => setIsAddHostOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 disabled:opacity-50 text-zinc-950 font-mono text-xs font-bold transition-all shadow-lg active:scale-95"
            >
              {isSubmitting ? 'Registering...' : 'Register Host'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Cyber-Glass Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetHost}
        onClose={() => setDeleteTargetHost(null)}
        onConfirm={handleConfirmDeleteHost}
        title={language === 'de' ? 'Datenbank-Host löschen' : 'Delete Database Host'}
        itemName={deleteTargetHost?.name}
        description={
          language === 'de'
            ? `Möchtest du den Datenbank-Host "${deleteTargetHost?.name}" wirklich löschen? Bestehende Datenbanken auf diesem Host müssen zuvor entfernt werden.`
            : `Are you sure you want to delete database host "${deleteTargetHost?.name}"? Existing databases on this host must be removed first.`
        }
        isDeleting={isDeletingHost}
      />
    </div>
  );
};
