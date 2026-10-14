import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../../../context/AppContext';
import { api } from '../../../api/client';
import { isBot, isWeb } from '../../../types';
import {
  KeyRound,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Copy,
  Check,
  Save,
  Search,
  FileCode,
  Lock,
  Unlock,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Sliders,
  ExternalLink,
  RotateCw,
  Download,
  Upload,
  CheckCircle2,
  X,
  HelpCircle,
} from 'lucide-react';

interface EnvVariable {
  id: string;
  key: string;
  value: string;
  isSecret: boolean;
  comment?: string;
}

function isLikelySecret(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes('secret') ||
    lower.includes('token') ||
    lower.includes('key') ||
    lower.includes('password') ||
    lower.includes('pwd') ||
    lower.includes('auth') ||
    lower.includes('private') ||
    lower.includes('salt') ||
    lower.includes('jwt') ||
    lower.includes('hash') ||
    lower.includes('webhook')
  );
}

function parseDotEnv(content: string): EnvVariable[] {
  const lines = content.split('\n');
  const vars: EnvVariable[] = [];
  let pendingComment = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#')) {
      pendingComment = line.replace(/^#\s*/, '');
      continue;
    }
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      const key = line.trim();
      vars.push({
        id: Math.random().toString(36).substring(2, 9),
        key,
        value: '',
        isSecret: isLikelySecret(key),
        comment: pendingComment,
      });
      pendingComment = '';
      continue;
    }
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars.push({
      id: Math.random().toString(36).substring(2, 9),
      key,
      value,
      isSecret: isLikelySecret(key),
      comment: pendingComment,
    });
    pendingComment = '';
  }
  return vars;
}

function serializeDotEnv(vars: EnvVariable[]): string {
  return vars
    .filter((v) => v.key.trim().length > 0)
    .map((v) => {
      const parts: string[] = [];
      if (v.comment) parts.push(`# ${v.comment}`);
      const needsQuotes = /[\s#"']/.test(v.value) || v.value.includes('\n');
      const valStr = needsQuotes ? `"${v.value.replace(/"/g, '\\"')}"` : v.value;
      parts.push(`${v.key.trim()}=${valStr}`);
      return parts.join('\n');
    })
    .join('\n\n');
}

export const EnvVaultTab: React.FC = () => {
  const { selectedServer, addToast } = useApp();
  const [variables, setVariables] = useState<EnvVariable[]>([]);
  const [initialContent, setInitialContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [restarting, setRestarting] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAllSecrets, setShowAllSecrets] = useState<boolean>(false);
  const [visibleSecretIds, setVisibleSecretIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Import / Raw modal
  const [isRawModalOpen, setIsRawModalOpen] = useState<boolean>(false);
  const [rawText, setRawText] = useState<string>('');

  const serverUuid = selectedServer?.uuid || selectedServer?.id || '';

  // Load .env from server
  const loadEnvFile = useCallback(async () => {
    if (!serverUuid) return;
    setLoading(true);
    try {
      const res = await api.files.getContent(serverUuid, '.env');
      const content = res.content || '';
      setInitialContent(content);
      const parsed = parseDotEnv(content);
      if (parsed.length === 0) {
        // Fallback default templates for convenient onboarding
        if (isBot(selectedServer)) {
          setVariables([
            { id: '1', key: 'DISCORD_TOKEN', value: '', isSecret: true, comment: 'Bot authorization token' },
            { id: '2', key: 'CLIENT_ID', value: '', isSecret: false, comment: 'Application Client ID' },
            { id: '3', key: 'BOT_PREFIX', value: '!', isSecret: false, comment: 'Command prefix' },
            { id: '4', key: 'NODE_ENV', value: 'production', isSecret: false },
          ]);
        } else if (isWeb(selectedServer)) {
          setVariables([
            { id: '1', key: 'PORT', value: '3000', isSecret: false, comment: 'Internal web listen port' },
            { id: '2', key: 'NODE_ENV', value: 'production', isSecret: false },
            { id: '3', key: 'DATABASE_URL', value: '', isSecret: true, comment: 'Relational database URL' },
            { id: '4', key: 'JWT_SECRET', value: '', isSecret: true, comment: 'Auth session encryption secret' },
          ]);
        } else {
          setVariables([
            { id: '1', key: 'PORT', value: '8080', isSecret: false },
            { id: '2', key: 'APP_ENV', value: 'production', isSecret: false },
            { id: '3', key: 'API_KEY', value: '', isSecret: true },
          ]);
        }
      } else {
        setVariables(parsed);
      }
    } catch (err) {
      console.warn('No .env found or failed reading .env; creating new vault buffer', err);
      // Initialize with fresh defaults
      const defaults: EnvVariable[] = isBot(selectedServer)
        ? [
            { id: '1', key: 'DISCORD_TOKEN', value: '', isSecret: true, comment: 'Discord Gateway Bot Token' },
            { id: '2', key: 'CLIENT_ID', value: '', isSecret: false },
            { id: '3', key: 'NODE_ENV', value: 'production', isSecret: false },
          ]
        : [
            { id: '1', key: 'PORT', value: '3000', isSecret: false },
            { id: '2', key: 'NODE_ENV', value: 'production', isSecret: false },
            { id: '3', key: 'SECRET_KEY', value: '', isSecret: true },
          ];
      setVariables(defaults);
      setInitialContent('');
    } finally {
      setLoading(false);
    }
  }, [serverUuid, selectedServer]);

  useEffect(() => {
    loadEnvFile();
  }, [loadEnvFile]);

  // Track dirty changes
  const currentSerialized = useMemo(() => serializeDotEnv(variables), [variables]);
  const isDirty = useMemo(() => {
    return currentSerialized.trim() !== initialContent.trim();
  }, [currentSerialized, initialContent]);

  // Toggle secret visibility
  const toggleSecretVisibility = (id: string) => {
    setVisibleSecretIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleAddVariable = (keyName: string = '', val: string = '', isSec: boolean = false, comment?: string) => {
    const newVar: EnvVariable = {
      id: Math.random().toString(36).substring(2, 9),
      key: keyName,
      value: val,
      isSecret: isSec || (keyName ? isLikelySecret(keyName) : false),
      comment,
    };
    setVariables((prev) => [...prev, newVar]);
  };

  const handleDeleteVariable = (id: string) => {
    setVariables((prev) => prev.filter((v) => v.id !== id));
  };

  const handleUpdateVariable = (id: string, updates: Partial<EnvVariable>) => {
    setVariables((prev) =>
      prev.map((v) => {
        if (v.id === id) {
          const updated = { ...v, ...updates };
          if (updates.key !== undefined && updates.isSecret === undefined) {
            updated.isSecret = isLikelySecret(updates.key);
          }
          return updated;
        }
        return v;
      })
    );
  };

  // Save changes to .env file
  const handleSave = async () => {
    if (!serverUuid) return;
    setSaving(true);
    try {
      const serialized = serializeDotEnv(variables);
      await api.files.saveContent(serverUuid, '.env', serialized);
      setInitialContent(serialized);
      addToast({
        title: 'Environment Vault Saved',
        description: 'Successfully updated .env on server filesystem.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('Failed to save .env file:', err);
      addToast({
        title: 'Save Failed',
        description: err?.message || 'Failed to write .env file to disk.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Optional restart server to apply environment
  const handleRestartServer = async () => {
    if (!serverUuid) return;
    setRestarting(true);
    try {
      await api.servers.power(serverUuid, 'restart');
      addToast({
        title: 'Server Restart Scheduled',
        description: 'Rebooting container to reload newly saved environment variables.',
        type: 'info',
      });
    } catch (err: any) {
      addToast({
        title: 'Restart Failed',
        description: err?.message || 'Could not send restart signal.',
        type: 'error',
      });
    } finally {
      setRestarting(false);
    }
  };

  // Open Raw Modal
  const handleOpenRawModal = () => {
    setRawText(serializeDotEnv(variables));
    setIsRawModalOpen(true);
  };

  // Apply Raw text
  const handleApplyRaw = () => {
    try {
      const parsed = parseDotEnv(rawText);
      setVariables(parsed);
      setIsRawModalOpen(false);
      addToast({
        title: 'Variables Imported',
        description: `Imported ${parsed.length} variables from raw .env format.`,
        type: 'success',
      });
    } catch (err: any) {
      addToast({
        title: 'Parse Error',
        description: 'Could not parse raw .env syntax.',
        type: 'error',
      });
    }
  };

  // Preset additions
  const addPreset = (type: 'db' | 'jwt' | 'redis' | 'discord') => {
    if (type === 'db') {
      handleAddVariable('DATABASE_URL', 'postgres://postgres:password@localhost:5432/production_db', true, 'Postgres connection URI');
    } else if (type === 'jwt') {
      const randomSecret = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      handleAddVariable('JWT_SECRET', randomSecret, true, 'HMAC SHA-256 Auth Secret');
    } else if (type === 'redis') {
      handleAddVariable('REDIS_URL', 'redis://127.0.0.1:6379', false, 'Redis cache link');
    } else if (type === 'discord') {
      handleAddVariable('DISCORD_BOT_TOKEN', '', true, 'Discord Developer Bot Token');
    }
  };

  // Filtered variables
  const filteredVariables = useMemo(() => {
    if (!searchQuery.trim()) return variables;
    const q = searchQuery.toLowerCase();
    return variables.filter(
      (v) =>
        v.key.toLowerCase().includes(q) ||
        v.value.toLowerCase().includes(q) ||
        (v.comment && v.comment.toLowerCase().includes(q))
    );
  }, [variables, searchQuery]);

  const secretCount = useMemo(() => variables.filter((v) => v.isSecret).length, [variables]);

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-[#161b22] to-slate-900 border border-[#30363d] p-5 shadow-xl">
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white tracking-tight">.env & Secret Vault</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Encrypted at Rest
                </span>
                {isDirty && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 animate-pulse">
                    Unsaved changes
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage runtime secrets, environment tokens, and configuration keys injected into your container root.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleOpenRawModal}
              className="px-3 py-2 rounded-xl text-xs font-medium text-slate-300 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] flex items-center gap-1.5 transition-colors shadow-sm"
              title="Edit or view raw .env file text"
            >
              <FileCode className="w-3.5 h-3.5 text-slate-400" />
              <span>Import / Raw</span>
            </button>

            <button
              onClick={loadEnvFile}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-white bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] transition-colors shadow-sm"
              title="Reload from disk"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md ${
                isDirty
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-amber-500/20'
                  : 'bg-[#21262d] text-slate-500 border border-[#30363d] cursor-not-allowed'
              }`}
            >
              {saving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>

            {isDirty === false && (
              <button
                onClick={handleRestartServer}
                disabled={restarting}
                className="px-3 py-2 rounded-xl text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1.5 transition-colors shadow-sm"
                title="Restart container so new variables are picked up"
              >
                <RotateCw className={`w-3.5 h-3.5 ${restarting ? 'animate-spin' : ''}`} />
                <span>Restart to Apply</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#30363d]/60 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total Variables:</span>
            <span className="font-mono font-bold text-white">{variables.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Masked Secrets:</span>
            <span className="font-mono font-bold text-amber-400">{secretCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Target File:</span>
            <span className="font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[11px]">
              /.env
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Scope:</span>
            <span className="text-slate-300">Container Runtime</span>
          </div>
        </div>
      </div>

      {/* ── Filter & Quick Preset Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#161b22] border border-[#30363d] p-3 rounded-xl">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search variables by key, value, or comment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0d1117] border border-[#30363d] focus:border-amber-500/60 rounded-lg text-xs text-white placeholder-slate-500 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Global Reveal Toggle */}
          <button
            onClick={() => setShowAllSecrets((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              showAllSecrets
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-[#21262d] border-[#30363d] text-slate-400 hover:text-slate-200'
            }`}
          >
            {showAllSecrets ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{showAllSecrets ? 'Mask All Secrets' : 'Reveal All Secrets'}</span>
          </button>

          {/* Quick Presets Dropdown */}
          <div className="flex items-center gap-1 border-l border-[#30363d] pl-2">
            <span className="text-[11px] text-slate-500 hidden sm:inline">Presets:</span>
            <button
              onClick={() => addPreset('db')}
              className="px-2 py-1 text-[11px] rounded bg-[#21262d] hover:bg-[#30363d] text-slate-300 border border-[#30363d] transition-colors"
              title="Add Database URL"
            >
              + Database
            </button>
            <button
              onClick={() => addPreset('jwt')}
              className="px-2 py-1 text-[11px] rounded bg-[#21262d] hover:bg-[#30363d] text-slate-300 border border-[#30363d] transition-colors"
              title="Add Random JWT Secret"
            >
              + JWT Secret
            </button>
            <button
              onClick={() => addPreset('redis')}
              className="px-2 py-1 text-[11px] rounded bg-[#21262d] hover:bg-[#30363d] text-slate-300 border border-[#30363d] transition-colors"
              title="Add Redis Connection"
            >
              + Redis
            </button>
          </div>

          {/* Add Variable Button */}
          <button
            onClick={() => handleAddVariable()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--theme-accent,#3b82f6)] hover:opacity-90 text-white flex items-center gap-1.5 transition-all shadow-sm ml-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Variable</span>
          </button>
        </div>
      </div>

      {/* ── Key-Value Variables Table ── */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            <span className="text-xs font-medium">Decrypting and loading .env vault...</span>
          </div>
        ) : filteredVariables.length === 0 ? (
          <div className="py-16 text-center px-4">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">No environment variables found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
              {searchQuery
                ? `No variables matching "${searchQuery}"`
                : 'Your server has no .env configuration yet. Add your first key-value pair or paste raw syntax.'}
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handleAddVariable()}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Variable</span>
              </button>
              <button
                onClick={handleOpenRawModal}
                className="px-3.5 py-2 rounded-xl text-xs font-medium bg-[#21262d] hover:bg-[#30363d] text-slate-300 border border-[#30363d] flex items-center gap-1.5 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Raw</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#30363d] bg-[#0d1117]/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider select-none">
                  <th className="py-3 px-4 w-[28%]">Key Name</th>
                  <th className="py-3 px-4 w-[42%]">Value</th>
                  <th className="py-3 px-3 w-[18%]">Notes / Comment</th>
                  <th className="py-3 px-4 w-[12%] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]/50">
                {filteredVariables.map((variable) => {
                  const isVisible = showAllSecrets || !variable.isSecret || !!visibleSecretIds[variable.id];
                  const isCopied = copiedId === variable.id;

                  return (
                    <tr
                      key={variable.id}
                      className="group hover:bg-[#1c2128]/70 transition-colors"
                    >
                      {/* Key Column */}
                      <td className="py-2.5 px-4 align-top">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={variable.key}
                            placeholder="KEY_NAME"
                            onChange={(e) =>
                              handleUpdateVariable(variable.id, {
                                key: e.target.value.toUpperCase().replace(/\s+/g, '_'),
                              })
                            }
                            className="w-full px-2.5 py-1.5 bg-[#0d1117] border border-[#30363d] focus:border-amber-500/80 rounded-lg text-white font-mono text-xs font-semibold placeholder-slate-600 outline-none transition-colors"
                          />
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[10px] text-slate-400 hover:text-slate-300">
                              <input
                                type="checkbox"
                                checked={variable.isSecret}
                                onChange={(e) =>
                                  handleUpdateVariable(variable.id, { isSecret: e.target.checked })
                                }
                                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-0 w-3 h-3"
                              />
                              <span>Mask Secret</span>
                            </label>
                            {variable.isSecret && (
                              <span className="text-[10px] px-1 rounded bg-amber-500/10 text-amber-400 font-mono">
                                Secret
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Value Column */}
                      <td className="py-2.5 px-4 align-top">
                        <div className="relative flex items-center">
                          <input
                            type={isVisible ? 'text' : 'password'}
                            value={variable.value}
                            placeholder="Value..."
                            onChange={(e) =>
                              handleUpdateVariable(variable.id, { value: e.target.value })
                            }
                            className="w-full pl-2.5 pr-20 py-1.5 bg-[#0d1117] border border-[#30363d] focus:border-amber-500/80 rounded-lg text-slate-200 font-mono text-xs placeholder-slate-600 outline-none transition-colors"
                          />
                          <div className="absolute right-1.5 flex items-center gap-1">
                            {variable.isSecret && (
                              <button
                                type="button"
                                onClick={() => toggleSecretVisibility(variable.id)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                title={isVisible ? 'Hide secret value' : 'Show secret value'}
                              >
                                {isVisible ? (
                                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleCopy(variable.value, variable.id)}
                              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title="Copy variable value"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Comment Column */}
                      <td className="py-2.5 px-3 align-top">
                        <input
                          type="text"
                          value={variable.comment || ''}
                          placeholder="Optional comment..."
                          onChange={(e) =>
                            handleUpdateVariable(variable.id, { comment: e.target.value })
                          }
                          className="w-full px-2 py-1.5 bg-transparent border border-transparent focus:border-[#30363d] focus:bg-[#0d1117] rounded-lg text-slate-400 text-xs placeholder-slate-600 outline-none transition-colors"
                        />
                      </td>

                      {/* Actions Column */}
                      <td className="py-2.5 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteVariable(variable.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete variable"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Bottom bar inside table container */}
        <div className="p-3 bg-[#0d1117]/60 border-t border-[#30363d] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Changes persist immediately to disk upon clicking &quot;Save Changes&quot;.</span>
          </div>
          <button
            onClick={() => handleAddVariable()}
            className="flex items-center gap-1 text-slate-300 hover:text-white font-medium hover:underline text-xs"
          >
            <Plus className="w-3 h-3" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {/* ── Raw .env Editor Modal ── */}
      {isRawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between bg-[#11161d]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Raw .env Syntax Editor</h3>
                  <p className="text-[11px] text-slate-400">
                    Paste existing .env configurations directly or copy the entire raw file.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRawModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Standard KEY=VALUE format with optional # comments:</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(rawText);
                    addToast({
                      title: 'Copied to Clipboard',
                      description: 'Raw .env text copied.',
                      type: 'info',
                    });
                  }}
                  className="flex items-center gap-1 text-amber-400 hover:underline"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy All</span>
                </button>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={'# Environment Configuration\nPORT=3000\nNODE_ENV=production\nDATABASE_URL="postgres://..."\nAPI_SECRET=your_super_secret_key'}
                rows={14}
                className="w-full p-3 bg-[#0d1117] border border-[#30363d] focus:border-amber-500/80 rounded-xl text-white font-mono text-xs outline-none resize-none leading-relaxed custom-scrollbar"
                spellCheck={false}
              />
            </div>

            <div className="p-4 border-t border-[#30363d] bg-[#11161d] flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Applying will parse and replace all rows in the table.
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsRawModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyRaw}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Parse & Apply to Vault</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
