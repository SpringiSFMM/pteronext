import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { api } from '../../api/client';
import {
  HardDrive,
  Plus,
  Trash2,
  KeyRound,
  Copy,
  Check,
  Terminal,
  Inbox,
  Edit3,
  Globe,
  Settings,
  Shield,
  Activity,
  Server,
  Save,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { DeleteConfirmModal } from '../common/DeleteConfirmModal';
import { useTranslation } from '../../i18n/useTranslation';
import { AdminNode } from '../../types';

const formatResourceMB = (mb: number): string => {
  if (isNaN(mb) || mb < 0) return '0 MB';
  if (mb >= 1024) {
    const gb = mb / 1024;
    return `${gb % 1 === 0 ? gb.toFixed(0) : gb.toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
};

export const AdminNodesView: React.FC = () => {
  const {
    adminNodes,
    adminLoading,
    createAdminNode,
    deleteAdminNode,
    updateAdminNode,
    refreshAdminData,
    addToast,
  } = useApp();
  const { language } = useTranslation();

  useEffect(() => {
    refreshAdminData();
  }, [refreshAdminData]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTargetNode, setDeleteTargetNode] = useState<AdminNode | null>(null);
  const [isDeletingNode, setIsDeletingNode] = useState(false);
  const [nodeName, setNodeName] = useState('');
  const [fqdn, setFqdn] = useState('');
  const [description, setDescription] = useState('');
  const [memoryMB, setMemoryMB] = useState('8192');
  const [diskMB, setDiskMB] = useState('102400');
  const [memoryOverallocate, setMemoryOverallocate] = useState('0');
  const [diskOverallocate, setDiskOverallocate] = useState('0');
  const [daemonPort, setDaemonPort] = useState('8080');
  const [sftpPort, setSftpPort] = useState('2022');
  const [isCreating, setIsCreating] = useState(false);

  // Edit Node State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<AdminNode | null>(null);
  const [editName, setEditName] = useState('');
  const [editFqdn, setEditFqdn] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editMemoryMB, setEditMemoryMB] = useState(8192);
  const [editDiskMB, setEditDiskMB] = useState(102400);
  const [editMemoryOverallocate, setEditMemoryOverallocate] = useState(0);
  const [editDiskOverallocate, setEditDiskOverallocate] = useState(0);
  const [editDaemonPort, setEditDaemonPort] = useState(8080);
  const [editSftpPort, setEditSftpPort] = useState(2022);
  const [editMaintenance, setEditMaintenance] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Wings configuration modal
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [configData, setConfigData] = useState<{
    token_id: string;
    token: string;
    yaml: string;
  } | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    const ok = await createAdminNode({
      name: nodeName.trim(),
      fqdn: fqdn.trim(),
      description: description.trim(),
      memory: parseInt(memoryMB, 10) || 1024,
      memory_overallocate: parseInt(memoryOverallocate, 10) || 0,
      disk: parseInt(diskMB, 10) || 10240,
      disk_overallocate: parseInt(diskOverallocate, 10) || 0,
      daemon_listen: parseInt(daemonPort, 10) || 8080,
      daemon_sftp: parseInt(sftpPort, 10) || 2022,
    });
    setIsCreating(false);
    if (ok) {
      setIsModalOpen(false);
      setNodeName('');
      setFqdn('');
      setDescription('');
      setMemoryOverallocate('0');
      setDiskOverallocate('0');
    }
  };

  const openEditModal = (node: AdminNode) => {
    setEditingNode(node);
    setEditName(node.name);
    setEditFqdn(node.fqdn);
    setEditDescription(node.location || '');
    setEditMemoryMB(node.ramTotalMB || 8192);
    setEditDiskMB(node.diskTotalMB || 102400);
    setEditMemoryOverallocate(node.memoryOverallocate || 0);
    setEditDiskOverallocate(node.diskOverallocate || 0);
    setEditDaemonPort(node.daemonPort || 8080);
    setEditSftpPort(node.sftpPort || 2022);
    setEditMaintenance(node.status === 'warning');
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode) return;
    setIsUpdating(true);
    try {
      const ok = await updateAdminNode(editingNode.id, {
        name: editName.trim(),
        fqdn: editFqdn.trim(),
        description: editDescription.trim(),
        memory: Number(editMemoryMB),
        memory_overallocate: Number(editMemoryOverallocate),
        disk: Number(editDiskMB),
        disk_overallocate: Number(editDiskOverallocate),
        daemon_listen: Number(editDaemonPort),
        daemon_sftp: Number(editSftpPort),
        maintenance_mode: editMaintenance,
      });
      if (ok) {
        setIsEditModalOpen(false);
        setEditingNode(null);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmDeleteNode = async () => {
    if (!deleteTargetNode) return;
    setIsDeletingNode(true);
    try {
      await deleteAdminNode(deleteTargetNode.id);
      setDeleteTargetNode(null);
    } finally {
      setIsDeletingNode(false);
    }
  };

  const openConfig = async (id: string) => {
    setConfigNodeId(id);
    setConfigData(null);
    setConfigLoading(true);
    try {
      const res = await api.nodes.configuration(id);
      setConfigData({ token_id: res.token_id, token: res.token, yaml: res.yaml });
    } catch (err: any) {
      addToast({
        title: 'Configuration Unavailable',
        description: err?.message || 'The daemon token could not be generated.',
        type: 'error',
      });
      setConfigNodeId(null);
    } finally {
      setConfigLoading(false);
    }
  };

  const copyValue = (label: string, value: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedField(label);
    addToast({ title: 'Copied', description: `${label} copied to clipboard.`, type: 'info' });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="space-y-6 view-enter">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.05] text-zinc-300 border border-white/10 font-semibold uppercase">
              Wings Cluster
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Nodes Infrastructure
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Real Wings daemon hosts registered in the panel core – provision, edit and manage nodes.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => refreshAdminData()}
            disabled={adminLoading}
            title="Refresh Node Metrics"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white border border-[#30363d] text-xs font-mono transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${adminLoading ? 'animate-spin text-zinc-300' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold font-mono transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Deploy Node</span>
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {adminLoading && adminNodes.length === 0 && (
        <div className="p-4 space-y-3 bg-[#11141a] rounded-2xl border border-[#30363d]">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 w-full bg-[#161b22] rounded animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!adminLoading && adminNodes.length === 0 && (
        <div className="p-10 text-center rounded-2xl bg-[#11141a] border border-[#30363d]">
          <div className="mx-auto w-11 h-11 rounded-xl bg-[#21262d] border border-[#30363d] flex items-center justify-center mb-3">
            <Inbox className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">No nodes registered</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Register your first Wings daemon host to start scheduling game server containers.
          </p>
          <button
            className="px-4 py-2 mt-4 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 text-xs font-bold font-mono"
            onClick={() => setIsModalOpen(true)}
          >
            Deploy Node
          </button>
        </div>
      )}

      {adminNodes.length > 0 && (
        <div className="rounded-2xl bg-[#11141a] border border-[#30363d] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 border-b border-[#30363d] font-mono text-[11px] uppercase bg-[#0d1117]/60">
                <tr>
                  <th className="py-3 px-4">Node Identity</th>
                  <th className="py-3 px-4">FQDN / Daemon</th>
                  <th className="py-3 px-4">Memory Allocation</th>
                  <th className="py-3 px-4">Disk Allocation</th>
                  <th className="py-3 px-4">Containers</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]/70">
                {adminNodes.map((node) => {
                  const ramAlloc = node.ramAllocatedMB || 0;
                  const ramTotal = node.ramTotalMB || 1;
                  const ramPercent = ramTotal > 0 ? Math.round((ramAlloc / ramTotal) * 100) : 0;
                  const ramBarWidth = Math.min(100, Math.max(0, ramPercent));
                  const isRamOver = ramPercent > 100;

                  const diskAlloc = node.diskAllocatedMB || 0;
                  const diskTotal = node.diskTotalMB || 1;
                  const diskPercent = diskTotal > 0 ? Math.round((diskAlloc / diskTotal) * 100) : 0;
                  const diskBarWidth = Math.min(100, Math.max(0, diskPercent));
                  const isDiskOver = diskPercent > 100;

                  return (
                    <tr key={node.id} className="hover:bg-[#161b22] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#161b22] border border-[#30363d] flex items-center justify-center text-slate-400 flex-shrink-0">
                            <Globe className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold text-white">{node.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">ID #{node.id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <p className="text-slate-200">
                          {node.fqdn}:{node.daemonPort}
                        </p>
                        <p className="text-slate-500 text-[10px]">
                          SFTP {node.sftpPort} {node.sslEnabled ? '(TLS)' : '(HTTP)'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="min-w-[130px]">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-slate-200 font-medium">
                              {formatResourceMB(ramAlloc)} / {formatResourceMB(ramTotal)}
                            </span>
                            <span
                              className={`text-[10px] font-semibold ${
                                isRamOver
                                  ? 'text-amber-400 font-bold'
                                  : ramPercent >= 90
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {ramPercent}%
                            </span>
                          </div>
                          <div className="w-full bg-[#0d1117] rounded-full h-1.5 mt-1 overflow-hidden border border-[#30363d]/60">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isRamOver
                                  ? 'bg-amber-400'
                                  : ramPercent >= 90
                                  ? 'bg-rose-400'
                                  : 'bg-zinc-300'
                              }`}
                              style={{ width: `${ramBarWidth}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                            <span>Allocated Quota</span>
                            {node.memoryOverallocate ? (
                              <span className="text-zinc-400">+{node.memoryOverallocate}% ovr</span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        <div className="min-w-[130px]">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-slate-200 font-medium">
                              {formatResourceMB(diskAlloc)} / {formatResourceMB(diskTotal)}
                            </span>
                            <span
                              className={`text-[10px] font-semibold ${
                                isDiskOver
                                  ? 'text-amber-400 font-bold'
                                  : diskPercent >= 90
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {diskPercent}%
                            </span>
                          </div>
                          <div className="w-full bg-[#0d1117] rounded-full h-1.5 mt-1 overflow-hidden border border-[#30363d]/60">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isDiskOver
                                  ? 'bg-amber-400'
                                  : diskPercent >= 90
                                  ? 'bg-rose-400'
                                  : 'bg-purple-500'
                              }`}
                              style={{ width: `${diskBarWidth}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                            <span>Allocated Storage</span>
                            {node.diskOverallocate ? (
                              <span className="text-zinc-400">+{node.diskOverallocate}% ovr</span>
                            ) : null}
                          </div>
                        </div>
                      </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-300">
                      {node.activeServers} / {node.totalAllocations}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                          node.status === 'healthy'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            node.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                        />
                        <span>
                          {node.status === 'healthy' ? 'Online' : 'Maintenance'}
                        </span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Edit Node */}
                        <button
                          onClick={() => openEditModal(node)}
                          title="Edit Node & Wings Settings"
                          className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white border border-[#30363d] transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Wings Token / config.yml */}
                        <button
                          onClick={() => openConfig(node.id)}
                          title="Wings config.yml & Token"
                          className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white border border-[#30363d] transition-colors"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Node */}
                        <button
                          onClick={() => setDeleteTargetNode(node)}
                          title="Delete node"
                          className="p-1.5 rounded-lg bg-[#21262d] hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-[#30363d] hover:border-rose-500/30 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Create Node Modal ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Deploy Wings Node"
        subtitle="Register a new host running the Wings daemon for container orchestration"
        icon={<Server className="w-4 h-4 text-emerald-400" />}
        badge="WINGS HOST"
        badgeColor="emerald"
        maxWidth="lg"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Node Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Node-FRA-01"
                value={nodeName}
                onChange={(e) => setNodeName(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                FQDN or Public IP *
              </label>
              <input
                type="text"
                required
                placeholder="node01.example.com or 185.190.140.22"
                value={fqdn}
                onChange={(e) => setFqdn(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
              Description / Location
            </label>
            <input
              type="text"
              placeholder="e.g. Frankfurt Datacenter, Rack 4"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Total Memory Limit (MB)
              </label>
              <input
                type="number"
                value={memoryMB}
                onChange={(e) => setMemoryMB(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Total Disk Limit (MB)
              </label>
              <input
                type="number"
                value={diskMB}
                onChange={(e) => setDiskMB(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Swap / Memory Overallocate (%)
              </label>
              <input
                type="number"
                value={memoryOverallocate}
                onChange={(e) => setMemoryOverallocate(e.target.value)}
                placeholder="0"
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Allow containers to use Swap memory beyond physical RAM (e.g. 20%)
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Disk Overallocate (%)
              </label>
              <input
                type="number"
                value={diskOverallocate}
                onChange={(e) => setDiskOverallocate(e.target.value)}
                placeholder="0"
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Disk overcommit ratio (0% = strict limit)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Daemon HTTP/WS Port
              </label>
              <input
                type="number"
                value={daemonPort}
                onChange={(e) => setDaemonPort(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Daemon SFTP Port
              </label>
              <input
                type="number"
                value={sftpPort}
                onChange={(e) => setSftpPort(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating}
              className="px-5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 font-mono text-xs font-bold transition-all shadow-md active:scale-95"
            >
              {isCreating ? 'Deploying...' : 'Deploy Node'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit Node Modal ── */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={editingNode ? `Edit Wings Node: ${editingNode.name}` : 'Edit Node'}
        subtitle="Update hardware limits, daemon ports, and maintenance status"
        icon={<Settings className="w-4 h-4 text-zinc-300" />}
        badge="NODE CONFIG"
        badgeColor="default"
        maxWidth="lg"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Node Name *
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                FQDN or Public IP *
              </label>
              <input
                type="text"
                required
                value={editFqdn}
                onChange={(e) => setEditFqdn(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
              Description / Location
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Total Memory Limit (MB)
              </label>
              <input
                type="number"
                value={editMemoryMB}
                onChange={(e) => setEditMemoryMB(Number(e.target.value))}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                {(editMemoryMB / 1024).toFixed(1)} GB Physical RAM
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Total Disk Limit (MB)
              </label>
              <input
                type="number"
                value={editDiskMB}
                onChange={(e) => setEditDiskMB(Number(e.target.value))}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                {(editDiskMB / 1024).toFixed(1)} GB Storage
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Swap / Memory Overallocate (%)
              </label>
              <input
                type="number"
                value={editMemoryOverallocate}
                onChange={(e) => setEditMemoryOverallocate(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Allow containers to use Swap memory beyond physical RAM (e.g. 20%)
              </span>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Disk Overallocate (%)
              </label>
              <input
                type="number"
                value={editDiskOverallocate}
                onChange={(e) => setEditDiskOverallocate(Number(e.target.value))}
                placeholder="0"
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
              <span className="text-[10px] text-slate-500 font-mono mt-1 block">
                Disk overcommit ratio (0% = strict limit)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Daemon HTTP/WS Port
              </label>
              <input
                type="number"
                value={editDaemonPort}
                onChange={(e) => setEditDaemonPort(Number(e.target.value))}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 font-medium">
                Daemon SFTP Port
              </label>
              <input
                type="number"
                value={editSftpPort}
                onChange={(e) => setEditSftpPort(Number(e.target.value))}
                className="w-full bg-[#0d1117] border border-[#30363d] focus:border-zinc-500 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Maintenance Mode Toggle */}
          <div
            onClick={() => setEditMaintenance(!editMaintenance)}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
              editMaintenance
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-[#0d1117] border-[#30363d] text-slate-300'
            }`}
          >
            <div>
              <span className="text-xs font-bold block">Maintenance Mode</span>
              <span className="text-[11px] text-slate-500 font-mono">
                Prevents new server creation on this node while active
              </span>
            </div>
            <div
              className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                editMaintenance
                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                  : 'border-[#30363d]'
              }`}
            >
              {editMaintenance && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
              onClick={() => setIsEditModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUpdating}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 font-mono text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isUpdating ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Wings Configuration & Token Modal ── */}
      <Modal
        isOpen={!!configNodeId}
        onClose={() => setConfigNodeId(null)}
        title="Wings Daemon Configuration"
        subtitle="Automatic configuration and authorization token for this node"
        icon={<Terminal className="w-4 h-4 text-purple-400" />}
        badge="CONFIG.YML"
        badgeColor="purple"
        maxWidth="lg"
      >
        {configLoading ? (
          <div className="p-8 text-center text-xs font-mono text-slate-400">
            Generating daemon token & config...
          </div>
        ) : configData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-[#0d1117] rounded-xl border border-[#30363d]">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                  Token ID
                </span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-[11px] font-mono text-slate-200 truncate">
                    {configData.token_id}
                  </code>
                  <button
                    className="p-1 text-slate-400 hover:text-white"
                    onClick={() => copyValue('Token ID', configData.token_id)}
                  >
                    {copiedField === 'Token ID' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-[#0d1117] rounded-xl border border-[#30363d]">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 block mb-1 font-mono">
                  Daemon Token
                </span>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-[11px] font-mono text-slate-200 truncate">
                    {configData.token}
                  </code>
                  <button
                    className="p-1 text-slate-400 hover:text-white"
                    onClick={() => copyValue('Token', configData.token)}
                  >
                    {copiedField === 'Token' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>/etc/pterodactyl/config.yml</span>
                </div>
                <button
                  className="flex items-center gap-1 text-slate-300 hover:text-white"
                  onClick={() => copyValue('Configuration', configData.yaml)}
                >
                  {copiedField === 'Configuration' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>Copy config.yml</span>
                </button>
              </div>
              <pre className="p-3.5 rounded-xl bg-[#0d1117] border border-[#30363d] text-[11px] font-mono text-emerald-400 overflow-auto max-h-72 whitespace-pre-wrap leading-relaxed">
                {configData.yaml}
              </pre>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Cyber-Glass Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetNode}
        onClose={() => setDeleteTargetNode(null)}
        onConfirm={handleConfirmDeleteNode}
        title={language === 'de' ? 'Node löschen' : 'Delete Node'}
        itemName={deleteTargetNode?.name}
        description={
          language === 'de'
            ? `Möchtest du den Node "${deleteTargetNode?.name}" (${deleteTargetNode?.fqdn}) wirklich dauerhaft löschen? Nodes mit zugewiesenen aktiven Containern können nicht gelöscht werden.`
            : `Are you sure you want to permanently delete node "${deleteTargetNode?.name}" (${deleteTargetNode?.fqdn})? Nodes with assigned servers cannot be deleted.`
        }
        isDeleting={isDeletingNode}
      />
    </div>
  );
};
