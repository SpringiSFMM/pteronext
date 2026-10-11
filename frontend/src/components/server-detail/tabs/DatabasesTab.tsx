import React, { useState } from 'react';
import { useApp } from '../../../context/AppContext';
import {
  Database,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Globe,
  DatabaseZap,
} from 'lucide-react';
import { Modal } from '../../common/Modal';

export const DatabasesTab: React.FC = () => {
  const { selectedServer, databases, addDatabase, deleteDatabase, addToast } = useApp();

  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dbName, setDbName] = useState('');
  const [dbHost, setDbHost] = useState('db-fra-01.internal.aether.io');

  const toggleReveal = (id: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, label: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    addToast({
      title: 'Copied to Clipboard',
      description: `Copied ${label}`,
      type: 'info',
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateDatabase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbName.trim()) return;

    await addDatabase({
      name: dbName.trim(),
      database: dbName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      host: dbHost,
      port: 3306,
      username: `u_${dbName.trim().toLowerCase().slice(0, 8)}`,
      password: `p4$$w0rd_${Math.random().toString(36).substring(2, 10)}!`,
    });

    setIsModalOpen(false);
    setDbName('');
  };

  const handleDeleteDatabase = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to permanently drop database "${name}"? This action cannot be undone.`)) {
      deleteDatabase(id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="cyber-glass rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white font-mono uppercase">
              PROVISIONED DATABASES
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Dedicated SQL databases assigned to container [{selectedServer?.name || 'Active'}]
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-bold shadow-md transition-all self-start sm:self-auto active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Database</span>
        </button>
      </div>

      {/* Empty State */}
      {databases.length === 0 ? (
        <div className="cyber-glass rounded-2xl p-12 border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-zinc-300 flex items-center justify-center mx-auto shadow-md">
            <DatabaseZap className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
            No Databases Provisioned
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-mono">
            No database instances are currently allocated to {selectedServer?.name}. Provision an isolated MySQL or PostgreSQL database instance below.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono text-xs font-bold shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Provision First Database</span>
          </button>
        </div>
      ) : (
        /* Databases Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {databases.map((db) => {
            const isRevealed = !!revealedPasswords[db.id];
            return (
              <div
                key={db.id}
                className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4 relative group hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
                        MySQL 8.0
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        {db.connections || 1} Active Conns
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white font-mono">{db.name}</h4>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteDatabase(db.id, db.name)}
                    title="Drop Database"
                    className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-900 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Database Credentials Form-Grid */}
                <div className="space-y-2.5 font-mono text-xs bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Database:</span>
                    <span className="text-white font-medium">{db.database}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Endpoint:</span>
                    <span className="text-zinc-200 font-medium">{db.host}:{db.port}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Username:</span>
                    <span className="text-slate-200">{db.username}</span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-slate-500">Password:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300 font-mono">
                        {isRevealed ? db.password : '••••••••••••••••'}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleReveal(db.id)}
                        className="text-slate-400 hover:text-white"
                        title={isRevealed ? 'Hide' : 'Reveal'}
                      >
                        {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {db.password && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(db.password!, 'Password', `pwd-${db.id}`)
                          }
                          className="text-slate-400 hover:text-white"
                          title="Copy Password"
                        >
                          {copiedKey === `pwd-${db.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action: Copy Connection String */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-mono text-slate-500">
                    Size: {db.sizeMB || 2.4} MB
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `mysql://${db.username}:${db.password || ''}@${db.host}:${db.port}/${db.database}`,
                        'JDBC Connection URI',
                        `uri-${db.id}`
                      )
                    }
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-mono text-xs transition-colors"
                  >
                    <Globe className="w-3 h-3 text-zinc-300" />
                    <span>Copy URI</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Database Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision Database"
        subtitle={`Create an isolated database attached to ${selectedServer?.name}`}
        icon={<Database className="w-4 h-4 text-emerald-400" />}
        badge="DATABASE"
        badgeColor="emerald"
      >
        <form onSubmit={handleCreateDatabase} className="space-y-4">
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
              Database Identifier
            </label>
            <input
              type="text"
              required
              placeholder="e.g. app_production"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
            />
            <p className="text-[10px] text-slate-500 mt-1 font-mono">
              Alphanumeric characters and underscores only.
            </p>
          </div>

          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5">
              Database Host
            </label>
            <select
              value={dbHost}
              onChange={(e) => setDbHost(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[var(--theme-accent,#e5a93c)]"
            >
              <option value="127.0.0.1">Default Local Database Host (127.0.0.1:3306)</option>
              <option value="db-fra-01.internal.aether.io">db-fra-01.internal.aether.io (Frankfurt)</option>
              <option value="db-iad-01.internal.aether.io">db-iad-01.internal.aether.io (Ashburn)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-mono font-bold text-xs shadow-md transition-all active:scale-95"
            >
              Provision Instance
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
