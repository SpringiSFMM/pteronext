import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Database, Plus, Trash2, Copy, Check, Lock, HardDrive, Network } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useTranslation } from '../../i18n/useTranslation';

export const DatabasesView: React.FC = () => {
  const { databases, addDatabase, deleteDatabase, addToast } = useApp();
  const { t, language } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [dbName, setDbName] = useState('');
  const [host, setHost] = useState('db-fra-01.matrix.internal');
  const [username, setUsername] = useState('matrix_app');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    addToast({
      title: language === 'de' ? 'In die Zwischenablage kopiert' : 'Copied to Clipboard',
      description: text,
      type: 'info',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbName) return;
    addDatabase({
      name: dbName,
      database: dbName.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      host,
      port: 3306,
      username,
      password: `sec_${Math.random().toString(36).substring(2, 10)}!`,
    });
    setDbName('');
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            {language === 'de' ? 'Datenbanken' : 'Databases'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {language === 'de'
              ? 'Verwaltete MySQL/MariaDB-Instanzen, Zugangsdaten und Datenbank-Hosts für Server.'
              : 'Managed database instances, connection strings, and hosts allocated to workloads.'}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-medium text-xs transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{language === 'de' ? 'Neue Datenbank' : 'New Database'}</span>
        </button>
      </div>

      {databases.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#161b22] border border-[#30363d] space-y-3">
          <Database className="w-10 h-10 text-slate-500 mx-auto opacity-50" />
          <h3 className="text-sm font-semibold text-white">
            {language === 'de' ? 'Keine Datenbanken vorhanden' : 'No databases provisioned'}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {language === 'de'
              ? 'Erstelle deine erste MySQL- oder PostgreSQL-Datenbank für diesen Cluster.'
              : 'Provision your first MySQL or PostgreSQL database instance for this workload.'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-900 font-bold text-xs"
          >
            {language === 'de' ? 'Datenbank erstellen' : 'Create Database'}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {databases.map((db) => (
            <div
              key={db.id}
              className="p-5 rounded-xl bg-[#161b22] border border-[#30363d] hover:border-[#484f58] transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-[#21262d] border border-[#30363d] text-slate-300">
                      <Database className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{db.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{db.database}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteDatabase(db.id)}
                    title={language === 'de' ? 'Datenbank löschen' : 'Drop Database'}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2 mt-4 text-xs font-mono">
                  <div className="p-2 rounded bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Endpoint</span>
                      <span className="text-slate-300">{db.host}:{db.port}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(`${db.host}:${db.port}`, `host-${db.id}`)}
                      className="p-1 text-slate-500 hover:text-slate-300"
                    >
                      {copiedId === `host-${db.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="p-2 rounded bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Username</span>
                      <span className="text-slate-300">{db.username}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(db.username, `user-${db.id}`)}
                      className="p-1 text-slate-500 hover:text-slate-300"
                    >
                      {copiedId === `user-${db.id}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {db.password && (
                    <div className="p-2 rounded bg-[#0d1117] border border-[#30363d] flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-500 block uppercase">Password</span>
                        <span className="text-slate-400 font-mono">••••••••••••</span>
                      </div>
                      <button
                        onClick={() => handleCopy(db.password!, `pass-${db.id}`)}
                        className="p-1 text-slate-500 hover:text-slate-300"
                      >
                        {copiedId === `pass-${db.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#30363d] flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>{db.connections} {language === 'de' ? 'aktive Verb.' : 'active conn'}</span>
                <span>{db.sizeMB} MB disk</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={language === 'de' ? 'Datenbank-Instanz bereitstellen' : 'Provision Database Instance'}
        subtitle={
          language === 'de'
            ? 'Erstelle eine neue MySQL- oder PostgreSQL-Datenbank auf den Cluster-Hosts'
            : 'Create a new MySQL or PostgreSQL database on cluster hosts'
        }
        icon={<Database className="w-4 h-4 text-zinc-200" />}
        badge="SQL INSTANCE"
        badgeColor="default"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Database Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. srv_auth_db"
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-sans"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Host Server
            </label>
            <select
              value={host}
              onChange={(e) => setHost(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-sans"
            >
              <option value="db-fra-01.matrix.internal">db-fra-01.matrix.internal (Frankfurt)</option>
              <option value="db-iad-01.matrix.internal">db-iad-01.matrix.internal (Ashburn)</option>
              <option value="db-sin-01.matrix.internal">db-sin-01.matrix.internal (Singapore)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              User Login Name
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#30363d]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-[#21262d] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-900 font-medium text-xs transition-colors"
            >
              Create Database
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
