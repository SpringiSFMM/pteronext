import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import api from '../../../api/client';
import { DeleteConfirmModal } from '../../common/DeleteConfirmModal';
import {
  Archive,
  Plus,
  Lock,
  Unlock,
  RotateCcw,
  Download,
  Trash2,
  ShieldCheck,
  KeyRound,
  FileText,
  Folder,
  Search,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
  FileArchive,
} from 'lucide-react';

interface BackupItem {
  id: number;
  uuid: string;
  name: string;
  is_successful: boolean;
  is_locked: boolean;
  is_encrypted: boolean;
  bytes: number;
  checksum: string;
  completed_at?: string;
  created_at: string;
}

export const BackupsTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const { language } = useTranslation();
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [deleteTargetBackup, setDeleteTargetBackup] = useState<BackupItem | null>(null);
  const [isDeletingBackup, setIsDeletingBackup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create Backup Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [encryptEnabled, setEncryptEnabled] = useState(false);
  const [encryptPassword, setEncryptPassword] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [ignoredFiles, setIgnoredFiles] = useState('.git\nlogs/*.log\ncache');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Full Restore Modal
  const [restoreModalBackup, setRestoreModalBackup] = useState<BackupItem | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [truncateBeforeRestore, setTruncateBeforeRestore] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Granular Restore / Inspect Contents Modal
  const [inspectBackup, setInspectBackup] = useState<BackupItem | null>(null);
  const [inspectPassword, setInspectPassword] = useState('');
  const [inspectFiles, setInspectFiles] = useState<string[]>([]);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectSearch, setInspectSearch] = useState('');
  const [restoringPath, setRestoringPath] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    if (!selectedServer?.uuid) return;
    try {
      const res = await api.backups.list(selectedServer.uuid);
      setBackups(res.data || []);
    } catch (err: any) {
      console.error('Failed to load backups:', err);
      addToast({
        title: 'Failed Loading Backups',
        description: err?.message || 'Could not retrieve server backups.',
        type: 'error',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedServer?.uuid, addToast]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBackups();
  };

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer?.uuid) return;
    if (!newName.trim()) {
      addToast({ title: 'Name Required', description: 'Please enter a backup name.', type: 'error' });
      return;
    }
    if (encryptEnabled && encryptPassword.length < 6) {
      addToast({
        title: 'Weak Password',
        description: 'Encryption passphrase must be at least 6 characters.',
        type: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const ignoredList = ignoredFiles
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await api.backups.create(selectedServer.uuid, {
        name: newName.trim(),
        is_locked: isLocked,
        encrypt_password: encryptEnabled ? encryptPassword : '',
        ignored_files: ignoredList,
      });

      addToast({
        title: 'Backup Created',
        description: res.message || `Archive "${newName}" created successfully.`,
        type: 'success',
      });

      setIsCreateOpen(false);
      setNewName('');
      setEncryptPassword('');
      setEncryptEnabled(false);
      setIsLocked(false);
      fetchBackups();
    } catch (err: any) {
      addToast({
        title: 'Backup Failed',
        description: err?.message || 'Failed creating server archive.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleLock = async (backup: BackupItem) => {
    if (!selectedServer?.uuid) return;
    try {
      await api.backups.toggleLock(selectedServer.uuid, backup.uuid);
      setBackups((prev) =>
        prev.map((b) => (b.uuid === backup.uuid ? { ...b, is_locked: !b.is_locked } : b))
      );
      addToast({
        title: backup.is_locked ? 'Backup Unlocked' : 'Backup Locked',
        description: backup.is_locked ? 'Backup can now be pruned or deleted.' : 'Backup is protected against deletion.',
        type: 'info',
      });
    } catch (err: any) {
      addToast({
        title: 'Action Failed',
        description: err?.message || 'Could not toggle lock state.',
        type: 'error',
      });
    }
  };

  const handleDelete = (backup: BackupItem) => {
    if (!selectedServer?.uuid) return;
    if (backup.is_locked) {
      addToast({
        title: language === 'de' ? 'Backup geschützt' : 'Backup Locked',
        description:
          language === 'de'
            ? 'Entsperre dieses Backup zuerst, bevor du es löschst.'
            : 'Unlock this backup before deleting it.',
        type: 'warning',
      });
      return;
    }
    setDeleteTargetBackup(backup);
  };

  const handleConfirmDeleteBackup = async () => {
    if (!selectedServer?.uuid || !deleteTargetBackup) return;
    setIsDeletingBackup(true);
    try {
      await api.backups.delete(selectedServer.uuid, deleteTargetBackup.uuid);
      setBackups((prev) => prev.filter((b) => b.uuid !== deleteTargetBackup.uuid));
      addToast({
        title: language === 'de' ? 'Backup gelöscht' : 'Backup Deleted',
        description:
          language === 'de'
            ? `Archiv "${deleteTargetBackup.name}" wurde dauerhaft entfernt.`
            : `Archive "${deleteTargetBackup.name}" has been removed.`,
        type: 'success',
      });
      setDeleteTargetBackup(null);
    } catch (err: any) {
      addToast({
        title: language === 'de' ? 'Löschen fehlgeschlagen' : 'Delete Failed',
        description: err?.message || 'Failed to remove backup.',
        type: 'error',
      });
    } finally {
      setIsDeletingBackup(false);
    }
  };

  const handleFullRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer?.uuid || !restoreModalBackup) return;

    setIsRestoring(true);
    try {
      const res = await api.backups.restore(selectedServer.uuid, restoreModalBackup.uuid, {
        truncate: truncateBeforeRestore,
        encrypt_password: restorePassword,
      });

      addToast({
        title: 'Restore Completed',
        description: res.message || 'Server filesystem restored from backup.',
        type: 'success',
      });

      setRestoreModalBackup(null);
      setRestorePassword('');
    } catch (err: any) {
      addToast({
        title: 'Restore Failed',
        description: err?.message || 'Could not restore backup. Verify password.',
        type: 'error',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const openInspectModal = async (backup: BackupItem) => {
    setInspectBackup(backup);
    setInspectPassword('');
    setInspectFiles([]);
    setInspectSearch('');

    if (!backup.is_encrypted) {
      loadContents(backup, '');
    }
  };

  const loadContents = async (backup: BackupItem, password?: string) => {
    if (!selectedServer?.uuid) return;
    setInspectLoading(true);
    try {
      const res = await api.backups.getContents(selectedServer.uuid, backup.uuid, password);
      setInspectFiles(res.files || []);
    } catch (err: any) {
      addToast({
        title: 'Decryption / Read Failed',
        description: err?.message || 'Could not list archive contents. Check passphrase.',
        type: 'error',
      });
    } finally {
      setInspectLoading(false);
    }
  };

  const handleRestoreSinglePath = async (filePath: string) => {
    if (!selectedServer?.uuid || !inspectBackup) return;
    setRestoringPath(filePath);
    try {
      const res = await api.backups.restoreFile(selectedServer.uuid, inspectBackup.uuid, {
        path: filePath,
        encrypt_password: inspectPassword,
      });
      addToast({
        title: 'Restored File',
        description: res.message || `Restored "${filePath}" successfully!`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Restore Failed',
        description: err?.message || `Failed to restore ${filePath}`,
        type: 'error',
      });
    } finally {
      setRestoringPath(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const filteredInspectFiles = inspectFiles.filter((f) =>
    f.toLowerCase().includes(inspectSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161b22] border border-[#30363d] rounded-2xl p-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Archive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-wide">
              Server Backups & Disaster Recovery
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              High-speed tar.gz archives, military-grade AES-256-GCM encryption & granular file-level restore
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-[#0d1117] hover:bg-[#21262d] text-slate-300 hover:text-white border border-[#30363d] rounded-xl transition-all disabled:opacity-50"
            title="Refresh backups list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Backup</span>
          </button>
        </div>
      </div>

      {/* Backup List Card */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-500 mb-3" />
            Scanning node storage for backups...
          </div>
        ) : backups.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-[#0d1117] border border-[#30363d] flex items-center justify-center mx-auto text-slate-500 mb-3">
              <FileArchive className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-medium text-slate-300">No backups found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Create an encrypted snapshot of your server filesystem to safeguard your worlds, configs, and player databases.
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-white text-xs font-medium rounded-xl border border-[#30363d] transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              Create First Backup
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#21262d]">
            {backups.map((b) => (
              <div
                key={b.uuid}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#1a202c]/50 transition-colors"
              >
                {/* Left: Info & Badges */}
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div
                    className={`p-2.5 rounded-xl border ${
                      b.is_encrypted
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    }`}
                  >
                    {b.is_encrypted ? <ShieldCheck className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white truncate">{b.name}</span>
                      {b.is_encrypted && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          <KeyRound className="w-2.5 h-2.5" />
                          AES-256
                        </span>
                      )}
                      {b.is_locked && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          <Lock className="w-2.5 h-2.5" />
                          Protected
                        </span>
                      )}
                      {b.is_successful ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle className="w-2.5 h-2.5" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-red-500/15 text-red-300 border border-red-500/30">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Failed
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-mono">
                      <span>{formatBytes(b.bytes)}</span>
                      <span>•</span>
                      <span>
                        {b.completed_at
                          ? new Date(b.completed_at).toLocaleString()
                          : new Date(b.created_at).toLocaleString()}
                      </span>
                      {b.checksum && (
                        <>
                          <span className="hidden md:inline">•</span>
                          <span className="hidden md:inline text-slate-500" title={`SHA256: ${b.checksum}`}>
                            SHA: {b.checksum.substring(0, 10)}…
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  {/* Inspect & Granular Restore */}
                  <button
                    onClick={() => openInspectModal(b)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-slate-200 hover:text-white text-xs font-medium rounded-xl border border-[#30363d] transition-all cursor-pointer"
                    title="Browse files inside archive & restore selectively"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Inspect & Extract</span>
                  </button>

                  {/* Full Restore */}
                  <button
                    onClick={() => {
                      setRestoreModalBackup(b);
                      setRestorePassword('');
                      setTruncateBeforeRestore(false);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-slate-200 hover:text-white text-xs font-medium rounded-xl border border-[#30363d] transition-all cursor-pointer"
                    title="Restore entire server"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Full Restore</span>
                  </button>

                  {/* Download */}
                  <a
                    href={selectedServer?.uuid ? api.backups.getDownloadUrl(selectedServer.uuid, b.uuid) : '#'}
                    download
                    className="p-2 bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white rounded-xl border border-[#30363d] transition-all cursor-pointer"
                    title="Download archive (.tar.gz)"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>

                  {/* Lock Toggle */}
                  <button
                    onClick={() => handleToggleLock(b)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer ${
                      b.is_locked
                        ? 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25'
                        : 'bg-[#21262d] text-slate-400 hover:text-white border-[#30363d] hover:bg-[#30363d]'
                    }`}
                    title={b.is_locked ? 'Unlock backup' : 'Lock backup to protect from deletion'}
                  >
                    {b.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(b)}
                    disabled={b.is_locked}
                    className="p-2 bg-[#21262d] hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-xl border border-[#30363d] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Delete backup"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CREATE BACKUP MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <Archive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Create New Backup</h3>
                  <p className="text-xs text-slate-400 mt-0.5">High-speed gzip tarball compression</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#21262d] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBackup} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
                  Backup Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pre-Update Snapshot"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              {/* Encryption Toggle */}
              <div className="p-3.5 bg-[#0d1117] border border-[#30363d] rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-medium text-white">AES-256-GCM Encryption</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={encryptEnabled}
                    onChange={(e) => setEncryptEnabled(e.target.checked)}
                    className="rounded bg-[#161b22] border-[#30363d] text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                </div>
                {encryptEnabled && (
                  <div>
                    <label className="block text-[11px] font-mono text-amber-300 mb-1">
                      Encryption Passphrase (Required to restore or inspect)
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter a strong passphrase"
                      value={encryptPassword}
                      onChange={(e) => setEncryptPassword(e.target.value)}
                      className="w-full bg-[#161b22] border border-amber-500/40 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white focus:outline-none transition-colors"
                    />
                  </div>
                )}
              </div>

              {/* Ignored files */}
              <div>
                <label className="block text-xs font-mono uppercase text-slate-300 mb-1">
                  Ignored Files & Patterns (One per line)
                </label>
                <textarea
                  rows={3}
                  value={ignoredFiles}
                  onChange={(e) => setIgnoredFiles(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] focus:border-emerald-500 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none transition-colors"
                />
              </div>

              {/* Lock toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-medium text-white">Lock Backup</span>
                  <p className="text-[11px] text-slate-400">Prevents automatic pruning or accidental deletion</p>
                </div>
                <input
                  type="checkbox"
                  checked={isLocked}
                  onChange={(e) => setIsLocked(e.target.checked)}
                  className="rounded bg-[#161b22] border-[#30363d] text-purple-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white font-medium rounded-xl hover:bg-[#21262d] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Archiving...
                    </>
                  ) : (
                    'Start Backup'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL RESTORE MODAL */}
      {restoreModalBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#30363d] pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Full Server Restore</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{restoreModalBackup.name}</p>
                </div>
              </div>
              <button
                onClick={() => setRestoreModalBackup(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#21262d] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFullRestore} className="space-y-4">
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                <AlertTriangle className="w-4 h-4 mb-1 text-red-400" />
                Restoring will overwrite current files on the server with this backup snapshot.
              </div>

              {restoreModalBackup.is_encrypted && (
                <div>
                  <label className="block text-xs font-mono uppercase text-amber-300 mb-1.5 font-medium">
                    Decryption Passphrase *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter backup encryption passphrase"
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    className="w-full bg-[#0d1117] border border-amber-500/50 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none transition-colors"
                  />
                </div>
              )}

              <div className="flex items-center justify-between py-2 border-t border-[#30363d]">
                <div>
                  <span className="text-xs font-medium text-white">Truncate Directory</span>
                  <p className="text-[11px] text-slate-400">Wipe server folder entirely before extracting archive</p>
                </div>
                <input
                  type="checkbox"
                  checked={truncateBeforeRestore}
                  onChange={(e) => setTruncateBeforeRestore(e.target.checked)}
                  className="rounded bg-[#161b22] border-[#30363d] text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={() => setRestoreModalBackup(null)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white font-medium rounded-xl hover:bg-[#21262d] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRestoring}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-medium text-xs rounded-xl shadow-lg shadow-amber-900/20 transition-all cursor-pointer"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    'Confirm Restore'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRANULAR RESTORE & INSPECT CONTENTS MODAL */}
      {inspectBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#30363d] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Granular File & Folder Restore</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Browse archive contents & restore individual files to live container
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectBackup(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#21262d] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Passphrase prompt if encrypted and files not loaded */}
            {inspectBackup.is_encrypted && inspectFiles.length === 0 ? (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2 text-amber-300 text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>This backup is AES-256 encrypted. Enter your passphrase to inspect contents:</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Passphrase"
                    value={inspectPassword}
                    onChange={(e) => setInspectPassword(e.target.value)}
                    className="flex-1 bg-[#0d1117] border border-[#30363d] focus:border-cyan-500 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none"
                  />
                  <button
                    onClick={() => loadContents(inspectBackup, inspectPassword)}
                    disabled={inspectLoading || !inspectPassword}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium rounded-xl disabled:opacity-50 cursor-pointer"
                  >
                    {inspectLoading ? 'Decrypting...' : 'Unlock & View'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Search Bar */}
                <div className="p-3.5 border-b border-[#30363d] bg-[#0d1117] flex items-center gap-2.5">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search files inside backup (e.g. server.properties, ops.json)..."
                    value={inspectSearch}
                    onChange={(e) => setInspectSearch(e.target.value)}
                    className="w-full bg-transparent text-xs text-white focus:outline-none placeholder-slate-500"
                  />
                  <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                    {filteredInspectFiles.length} items
                  </span>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto p-3 divide-y divide-[#21262d] max-h-96">
                  {inspectLoading ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-cyan-400 mb-2" />
                      Reading archive headers...
                    </div>
                  ) : filteredInspectFiles.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">
                      No matching files found inside backup.
                    </div>
                  ) : (
                    filteredInspectFiles.map((file) => {
                      const isDir = file.endsWith('/');
                      const isBeingRestored = restoringPath === file;
                      return (
                        <div
                          key={file}
                          className="py-2.5 px-3 flex items-center justify-between gap-3 hover:bg-[#0d1117]/60 rounded-xl transition-colors group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isDir ? (
                              <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                            )}
                            <span className="text-xs font-mono text-slate-300 truncate group-hover:text-white">
                              {file}
                            </span>
                          </div>

                          <button
                            onClick={() => handleRestoreSinglePath(file)}
                            disabled={isBeingRestored}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#21262d] hover:bg-emerald-600 text-slate-300 hover:text-white text-[11px] font-medium rounded-lg border border-[#30363d] transition-all cursor-pointer disabled:opacity-50"
                          >
                            {isBeingRestored ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin text-white" />
                                <span>Restoring...</span>
                              </>
                            ) : (
                              <>
                                <RotateCcw className="w-3 h-3" />
                                <span>Restore</span>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-[#30363d] bg-[#161b22] flex justify-end">
                  <button
                    onClick={() => setInspectBackup(null)}
                    className="px-4 py-2 text-xs text-slate-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] rounded-xl transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cyber-Glass Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTargetBackup}
        onClose={() => setDeleteTargetBackup(null)}
        onConfirm={handleConfirmDeleteBackup}
        title={language === 'de' ? 'Backup löschen' : 'Delete Backup'}
        itemName={deleteTargetBackup?.name}
        description={
          language === 'de'
            ? `Möchtest du das Backup-Archiv "${deleteTargetBackup?.name}" wirklich unwiderruflich löschen? Alle gespeicherten Serverdaten dieser Sicherung gehen verloren.`
            : `Are you sure you want to permanently delete backup archive "${deleteTargetBackup?.name}"? All stored snapshot data in this archive will be lost.`
        }
        isDeleting={isDeletingBackup}
      />
    </div>
  );
};
