import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { api } from '../../../api/client';
import {
  Database,
  Plus,
  Trash2,
  Zap,
  Eye,
  EyeOff,
  Copy,
  Check,
  Table,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Server,
  FolderTree,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../../common/Modal';
import { DeleteConfirmModal } from '../../common/DeleteConfirmModal';
import { useTranslation } from '../../../i18n/useTranslation';

interface SidecarInstance {
  id: number;
  server_id: number;
  name: string;
  type: 'redis' | 'postgres' | 'mariadb' | 'sqlite';
  status: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password?: string;
  memory_mb: number;
}

export const SidecarsTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const { language } = useTranslation();

  const [sidecars, setSidecars] = useState<SidecarInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Delete modal state
  const [deleteTargetSidecar, setDeleteTargetSidecar] = useState<SidecarInstance | null>(null);
  const [isDeletingSidecar, setIsDeletingSidecar] = useState(false);

  // Creation modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sidecarType, setSidecarType] = useState<'redis' | 'postgres' | 'mariadb' | 'sqlite'>('redis');
  const [sidecarName, setSidecarName] = useState('');
  const [sidecarMemory, setSidecarMemory] = useState(256);
  const [creating, setCreating] = useState(false);

  // Injection modal
  const [injectingSidecar, setInjectingSidecar] = useState<SidecarInstance | null>(null);
  const [targetPlugin, setTargetPlugin] = useState('luckperms');
  const [injecting, setInjecting] = useState(false);

  // Web-DB-Viewer state
  const [availableDatabases, setAvailableDatabases] = useState<string[]>([]);
  const [selectedDbFile, setSelectedDbFile] = useState<string>('');
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  const fetchSidecars = async () => {
    if (!selectedServer?.uuid) return;
    try {
      setLoading(true);
      const res = await api.sidecars.list(selectedServer.uuid);
      if (res?.data) {
        setSidecars(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load sidecars:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWebDbExplorer = async (fileToSelect?: string) => {
    if (!selectedServer?.uuid) return;
    try {
      setTableLoading(true);
      const res = await api.sidecars.getTables(selectedServer.uuid, fileToSelect || selectedDbFile);
      if (res) {
        setAvailableDatabases(res.available_databases || []);
        const activeFile = res.selected_file || fileToSelect || '';
        setSelectedDbFile(activeFile);
        setTables(res.tables || []);
        if (res.tables && res.tables.length > 0) {
          const firstTable = res.tables[0];
          setSelectedTable(firstTable);
          fetchTableQuery(activeFile, firstTable);
        } else {
          setSelectedTable('');
          setTableColumns([]);
          setTableRows([]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load tables:', err);
    } finally {
      setTableLoading(false);
    }
  };

  const fetchTableQuery = async (file: string, table: string) => {
    if (!selectedServer?.uuid || !file || !table) return;
    try {
      setTableLoading(true);
      const res = await api.sidecars.query(selectedServer.uuid, { file, table, limit: 100 });
      if (res) {
        setTableColumns(res.columns || []);
        setTableRows(res.rows || []);
      }
    } catch (err: any) {
      addToast({
        title: 'Table Query Failed',
        description: err.message || 'Could not query table records',
        type: 'error',
      });
    } finally {
      setTableLoading(false);
    }
  };

  useEffect(() => {
    fetchSidecars();
    fetchWebDbExplorer();
  }, [selectedServer?.uuid]);

  const copyToClipboard = (text: string, label: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    addToast({
      title: 'Copied',
      description: `Copied ${label} to clipboard`,
      type: 'info',
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateSidecar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer?.uuid) return;
    try {
      setCreating(true);
      await api.sidecars.create(selectedServer.uuid, {
        name: sidecarName || `${sidecarType}-instance`,
        type: sidecarType,
        memory_mb: sidecarMemory,
      });
      addToast({
        title: 'Sidecar Container Created',
        description: `Dedicated ${sidecarType.toUpperCase()} container attached to ${selectedServer.name}.`,
        type: 'success',
      });
      setIsCreateModalOpen(false);
      setSidecarName('');
      fetchSidecars();
    } catch (err: any) {
      addToast({
        title: 'Creation Failed',
        description: err.message || 'Could not launch sidecar',
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteSidecar = (sidecar: SidecarInstance) => {
    setDeleteTargetSidecar(sidecar);
  };

  const handleConfirmDeleteSidecar = async () => {
    if (!selectedServer?.uuid || !deleteTargetSidecar) return;
    setIsDeletingSidecar(true);
    try {
      await api.sidecars.delete(selectedServer.uuid, deleteTargetSidecar.id);
      addToast({
        title: language === 'de' ? 'Sidecar entfernt' : 'Sidecar Removed',
        description:
          language === 'de'
            ? `${deleteTargetSidecar.name} wurde erfolgreich getrennt und gelöscht.`
            : `${deleteTargetSidecar.name} was successfully detached and deleted.`,
        type: 'info',
      });
      setDeleteTargetSidecar(null);
      fetchSidecars();
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Löschen fehlgeschlagen' : 'Delete Failed',
        description: err.message || 'Could not delete sidecar',
        type: 'error',
      });
    } finally {
      setIsDeletingSidecar(false);
    }
  };

  const handleInjectCredentials = async () => {
    if (!selectedServer?.uuid || !injectingSidecar) return;
    try {
      setInjecting(true);
      const res = await api.sidecars.inject(selectedServer.uuid, injectingSidecar.id, targetPlugin);
      addToast({
        title: 'Credentials Injected!',
        description: res.message || `Successfully configured ${targetPlugin}.yml with database credentials.`,
        type: 'success',
      });
      setInjectingSidecar(null);
    } catch (err: any) {
      addToast({
        title: 'Injection Failed',
        description: err.message || 'Could not inject configuration',
        type: 'error',
      });
    } finally {
      setInjecting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-wide font-sans">
              Container Sidecars & Web-DB-Viewer
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              Docker Network Mesh
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Spawn isolated Redis, PostgreSQL or SQLite companions, auto-inject plugin credentials, and explore tables in-panel.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchSidecars();
              fetchWebDbExplorer();
            }}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
            title="Refresh Sidecars"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Attach Sidecar</span>
          </button>
        </div>
      </div>

      {/* Sidecars Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Active Companions ({sidecars.length})
            </h3>
          </div>
        </div>

        {sidecars.length === 0 ? (
          <div className="cyber-glass rounded-2xl p-8 border border-slate-800 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-white font-mono">No Companion Sidecars Attached</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto font-mono">
              Accelerate your server by attaching dedicated Redis caching, isolated PostgreSQL, or embedded SQLite instances directly inside the container network.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sidecars.map((sc) => {
              const isPasswordRevealed = revealedPasswords[sc.id] || false;
              const typeColor =
                sc.type === 'redis'
                  ? 'text-rose-400 bg-rose-500/10 border-rose-500/20'
                  : sc.type === 'postgres'
                  ? 'text-sky-400 bg-sky-500/10 border-sky-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

              return (
                <div
                  key={sc.id}
                  className="cyber-glass rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold uppercase border ${typeColor}`}>
                        {sc.type}
                      </span>
                      <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        RUNNING ({sc.memory_mb} MB)
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-white tracking-wide mb-3">
                      {sc.name}
                    </h4>

                    {/* Connection details */}
                    <div className="space-y-1.5 text-xs font-mono bg-[#0d1117] p-3 rounded-xl border border-slate-800/80">
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Host:</span>
                        <span className="text-white font-semibold">{sc.host}:{sc.port}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span>Database:</span>
                        <span className="text-white">{sc.database}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400">
                        <span>User:</span>
                        <span className="text-white">{sc.username}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-400 pt-1 border-t border-slate-800">
                        <span>Password:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-200">
                            {isPasswordRevealed ? sc.password || '●●●●●●●●' : '••••••••'}
                          </span>
                          <button
                            onClick={() =>
                              setRevealedPasswords((prev) => ({
                                ...prev,
                                [sc.id]: !prev[sc.id],
                              }))
                            }
                            className="text-slate-500 hover:text-slate-300"
                          >
                            {isPasswordRevealed ? (
                              <EyeOff className="w-3 h-3" />
                            ) : (
                              <Eye className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            onClick={() =>
                              copyToClipboard(sc.password || '', 'Password', `pw-${sc.id}`)
                            }
                            className="text-slate-500 hover:text-slate-300"
                          >
                            {copiedKey === `pw-${sc.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Auto-Inject & Delete */}
                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-slate-800/80">
                    <button
                      onClick={() => setInjectingSidecar(sc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-mono font-medium transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-Inject Config</span>
                    </button>

                    <button
                      onClick={() => handleDeleteSidecar(sc)}
                      className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                      title="Delete Sidecar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Web-DB-Viewer (Table Explorer) */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white font-mono uppercase tracking-wider">
              Web-DB-Viewer (Table Explorer)
            </h3>
          </div>

          {/* Database File Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-mono">Database Source:</span>
            <select
              value={selectedDbFile}
              onChange={(e) => {
                setSelectedDbFile(e.target.value);
                fetchWebDbExplorer(e.target.value);
              }}
              className="px-3 py-1.5 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              {availableDatabases.length === 0 ? (
                <option value="">No local SQLite databases detected</option>
              ) : (
                availableDatabases.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Table selector & Records display */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          {/* Table List Column */}
          <div className="bg-[#0d1117] rounded-xl p-3 border border-slate-800/80 space-y-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
              Tables ({tables.length})
            </span>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {tables.map((tbl) => (
                <button
                  key={tbl}
                  onClick={() => {
                    setSelectedTable(tbl);
                    fetchTableQuery(selectedDbFile, tbl);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between ${
                    selectedTable === tbl
                      ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  }`}
                >
                  <span className="truncate">{tbl}</span>
                  <ChevronRight className="w-3 h-3 shrink-0" />
                </button>
              ))}
              {tables.length === 0 && (
                <p className="text-xs text-slate-500 font-mono py-4 text-center">
                  No tables found.
                </p>
              )}
            </div>
          </div>

          {/* Table Records Column */}
          <div className="md:col-span-3 bg-[#0d1117] rounded-xl p-3 border border-slate-800/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="text-xs font-mono font-semibold text-white">
                  {selectedTable ? `Table: ${selectedTable}` : 'Select a table'}
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  Showing {tableRows.length} records (max 100)
                </span>
              </div>

              {tableLoading ? (
                <div className="py-16 text-center text-xs font-mono text-slate-500 animate-pulse">
                  Executing read query against database storage...
                </div>
              ) : tableRows.length === 0 ? (
                <div className="py-16 text-center text-xs font-mono text-slate-500">
                  {selectedTable ? 'Table contains 0 records.' : 'Select a database table on the left to preview data.'}
                </div>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                        {tableColumns.map((col) => (
                          <th key={col} className="pb-2 pr-4 whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {tableRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-800/20">
                          {tableColumns.map((col) => (
                            <td key={col} className="py-2 pr-4 text-slate-300 whitespace-nowrap max-w-[200px] truncate">
                              {String(row[col] !== undefined && row[col] !== null ? row[col] : 'NULL')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attach Sidecar Modal */}
      {isCreateModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsCreateModalOpen(false)}
          title="ATTACH COMPANION SIDECAR CONTAINER"
        >
          <form onSubmit={handleCreateSidecar} className="space-y-4">
            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                Sidecar Technology
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'redis', label: 'Redis Cache (v7.2)', desc: 'Lightning-fast in-memory cache' },
                  { id: 'postgres', label: 'PostgreSQL (v16)', desc: 'Enterprise relational SQL' },
                  { id: 'mariadb', label: 'MariaDB / MySQL', desc: 'Standard plugin database' },
                  { id: 'sqlite', label: 'SQLite Fast Store', desc: 'Embedded lightweight store' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSidecarType(item.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      sidecarType === item.id
                        ? 'border-amber-500 bg-amber-500/10 text-white'
                        : 'border-slate-800 bg-[#0d1117] text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                Instance Name
              </label>
              <input
                type="text"
                placeholder={`e.g. ${sidecarType}-prod`}
                value={sidecarName}
                onChange={(e) => setSidecarName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-slate-400 uppercase block mb-1">
                Memory Allocation (MB)
              </label>
              <input
                type="number"
                min={64}
                max={4096}
                value={sidecarMemory}
                onChange={(e) => setSidecarMemory(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold transition-colors shadow-md disabled:opacity-50"
              >
                {creating ? 'Attaching...' : 'Deploy Container'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Auto-Inject Modal */}
      {injectingSidecar && (
        <Modal
          isOpen={true}
          onClose={() => setInjectingSidecar(null)}
          title={`AUTO-INJECT CREDENTIALS: ${injectingSidecar.name}`}
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-300 font-mono">
              Select which plugin configuration file to automatically populate with host, port, user, and password parameters.
            </p>

            <div className="space-y-2">
              <label className="text-[11px] font-mono text-slate-400 uppercase">
                Target Plugin Configuration
              </label>
              <select
                value={targetPlugin}
                onChange={(e) => setTargetPlugin(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              >
                <option value="luckperms">LuckPerms (plugins/LuckPerms/config.yml)</option>
                <option value="coreprotect">CoreProtect (plugins/CoreProtect/config.yml)</option>
                <option value="plan">Plan Player Analytics (plugins/Plan/config.yml)</option>
                <option value="vault">Vault / Economy Store</option>
              </select>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
              <div>Injected Host: <span className="text-emerald-400">{injectingSidecar.host}:{injectingSidecar.port}</span></div>
              <div>Database: <span className="text-emerald-400">{injectingSidecar.database}</span></div>
              <div>Username: <span className="text-emerald-400">{injectingSidecar.username}</span></div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInjectingSidecar(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-mono transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInjectCredentials}
                disabled={injecting}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-mono font-bold transition-colors shadow-md disabled:opacity-50"
              >
                {injecting ? 'Injecting...' : 'Inject & Save Config'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cyber-Glass Delete Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetSidecar}
        onClose={() => setDeleteTargetSidecar(null)}
        onConfirm={handleConfirmDeleteSidecar}
        title={language === 'de' ? 'Sidecar löschen' : 'Delete Sidecar'}
        itemName={deleteTargetSidecar?.name}
        description={
          language === 'de'
            ? `Möchtest du den Sidecar-Container "${deleteTargetSidecar?.name}" (${deleteTargetSidecar?.type}) wirklich dauerhaft entfernen? Alle Daten im Container gehen verloren.`
            : `Are you sure you want to permanently remove sidecar container "${deleteTargetSidecar?.name}" (${deleteTargetSidecar?.type})? All local instance data will be lost.`
        }
        isDeleting={isDeletingSidecar}
      />
    </div>
  );
};
