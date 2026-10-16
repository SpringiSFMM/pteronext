import React, { useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { api } from '../../../api/client';
import {
  Activity,
  User,
  Clock,
  Terminal,
  FileText,
  RotateCw,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Shield,
  FileCode,
  Download,
} from 'lucide-react';

interface AuditLogEntry {
  id: number;
  timestamp: string;
  user_id?: number;
  actor_id?: number;
  username?: string;
  ip_address?: string;
  ip?: string;
  action?: string;
  event?: string;
  target?: string;
  details?: string;
  properties?: string;
}

export const ServerAuditTab: React.FC = () => {
  const { selectedServer } = useApp();
  const { language } = useTranslation();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  const fetchAuditLogs = async () => {
    if (!selectedServer?.uuid) return;
    try {
      setLoading(true);
      const res = await api.serverAudit.list(selectedServer.uuid);
      if (res?.data && Array.isArray(res.data)) {
        setLogs(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load server audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [selectedServer?.uuid]);

  const exportLogs = (format: 'csv' | 'json', scope: 'filtered' | 'all') => {
    const list = scope === 'filtered' ? filteredLogs : logs;
    const records = list.map((entry) => ({
      timestamp: entry.timestamp,
      user: entry.username || 'System Daemon',
      ip_address: entry.ip_address || entry.ip || '127.0.0.1',
      action: entry.action || entry.event || 'action',
      description: entry.details || entry.target || entry.properties || '-',
    }));

    const dateStr = new Date().toISOString().split('T')[0];
    const srvName = (selectedServer?.name || 'server').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `server-${srvName}-audit-${scope}-${dateStr}.${format}`;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(records, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = [
        language === 'de' ? 'Zeitstempel' : 'Timestamp',
        language === 'de' ? 'Benutzer' : 'User',
        language === 'de' ? 'IP-Adresse' : 'IP Address',
        language === 'de' ? 'Aktion' : 'Action',
        language === 'de' ? 'Beschreibung' : 'Description',
      ];
      const escapeCell = (val: string) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = records.map((r) =>
        [
          escapeCell(r.timestamp),
          escapeCell(r.user),
          escapeCell(r.ip_address),
          escapeCell(r.action),
          escapeCell(r.description),
        ].join(',')
      );

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const getActionIcon = (actionStr: string) => {
    const act = (actionStr || '').toLowerCase();
    if (act.includes('file') || act.includes('write') || act.includes('delete')) {
      return <FileText className="w-3.5 h-3.5 text-indigo-400" />;
    }
    if (act.includes('command') || act.includes('console')) {
      return <Terminal className="w-3.5 h-3.5 text-amber-400" />;
    }
    if (act.includes('power') || act.includes('restart') || act.includes('stop') || act.includes('start')) {
      return <RotateCw className="w-3.5 h-3.5 text-emerald-400" />;
    }
    return <Activity className="w-3.5 h-3.5 text-sky-400" />;
  };

  const filteredLogs = logs.filter((log) => {
    const act = (log.action || log.event || '').toLowerCase();
    const usr = (log.username || '').toLowerCase();
    const tgt = (log.target || '').toLowerCase();
    const dtl = (log.details || '').toLowerCase();
    const q = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !q || act.includes(q) || usr.includes(q) || tgt.includes(q) || dtl.includes(q);

    const matchesFilter =
      filterAction === 'all' || act.includes(filterAction);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-sky-400" />
            <h2 className="text-base font-bold text-white tracking-wide font-sans">
              {language === 'de' ? 'Audit-Logging & Incident Trace' : 'Audit Logging & Incident Trace'}
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
              {language === 'de' ? 'Unveränderbares Protokoll' : 'Immutable Log'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {language === 'de'
              ? 'Protokolliert manipulationssicher alle Aktionen, Server-Starts, Konsolenbefehle und Dateiänderungen.'
              : 'Tamper-proof tracking of all administrative actions, power state modifications, and console executions.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick CSV Export */}
          <button
            onClick={() => exportLogs('csv', searchQuery || filterAction !== 'all' ? 'filtered' : 'all')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            title={language === 'de' ? 'Als CSV exportieren' : 'Export as CSV'}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>

          {/* Quick JSON Export */}
          <button
            onClick={() => exportLogs('json', searchQuery || filterAction !== 'all' ? 'filtered' : 'all')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium transition-colors cursor-pointer"
            title={language === 'de' ? 'Als JSON exportieren' : 'Export as JSON'}
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            <span>JSON</span>
          </button>

          <button
            onClick={fetchAuditLogs}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title={language === 'de' ? 'Protokolle aktualisieren' : 'Refresh Audit Logs'}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="cyber-glass rounded-2xl p-4 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              language === 'de'
                ? 'Nach Benutzer, Aktion, Zielpfad oder Befehl suchen...'
                : 'Search by user, action, target path, or command...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-[#0d1117] border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
          >
            <option value="all">{language === 'de' ? 'Alle Aktionen' : 'All Actions'}</option>
            <option value="file">{language === 'de' ? 'Datei-Änderungen' : 'File Changes'}</option>
            <option value="command">{language === 'de' ? 'Konsolenbefehle' : 'Console Commands'}</option>
            <option value="power">{language === 'de' ? 'Server-Status' : 'Power State'}</option>
            <option value="security">{language === 'de' ? 'Sicherheit & 2FA' : 'Security & Moderation'}</option>
          </select>
        </div>
      </div>

      {/* Audit Feed Table */}
      <div className="cyber-glass rounded-2xl p-5 border border-slate-800 space-y-4">
        {loading ? (
          <div className="py-12 text-center text-xs font-mono text-slate-500 animate-pulse">
            {language === 'de' ? 'Lade Audit-Protokolle...' : 'Loading immutable audit logs...'}
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs font-mono text-slate-500 bg-[#0d1117]/30 rounded-xl border border-slate-800/50">
            {language === 'de'
              ? 'Keine Audit-Einträge entsprechen den aktuellen Such- und Filterkriterien.'
              : 'No audit records match the current filter criteria.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[11px]">
                  <th className="pb-2.5">{language === 'de' ? 'Zeitpunkt' : 'Timestamp'}</th>
                  <th className="pb-2.5">{language === 'de' ? 'Akteur' : 'Actor'}</th>
                  <th className="pb-2.5">{language === 'de' ? 'Aktion' : 'Action'}</th>
                  <th className="pb-2.5">{language === 'de' ? 'Ziel / Details' : 'Target / Payload'}</th>
                  <th className="pb-2.5">{language === 'de' ? 'IP-Adresse' : 'IP Address'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((entry, idx) => {
                  const actionStr = entry.action || entry.event || 'action';
                  const ipStr = entry.ip_address || entry.ip || '127.0.0.1';
                  const usernameStr = entry.username || (language === 'de' ? 'System-Dienst' : 'System Daemon');
                  const targetOrDetails = entry.details || entry.target || '-';

                  return (
                    <tr key={entry.id || idx} className="hover:bg-slate-800/20 transition-colors">
                      <td className="py-2.5 text-slate-400 whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString(language === 'de' ? 'de-DE' : 'en-US', {
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2.5 text-white font-semibold flex items-center gap-1.5 whitespace-nowrap">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {usernameStr}
                      </td>
                      <td className="py-2.5">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#0d1117] border border-slate-800 text-slate-200">
                          {getActionIcon(actionStr)}
                          <span className="capitalize">{actionStr.replace(/[:_]/g, ' ')}</span>
                        </span>
                      </td>
                      <td className="py-2.5 text-slate-300 max-w-xs truncate" title={targetOrDetails}>
                        {targetOrDetails}
                      </td>
                      <td className="py-2.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {ipStr}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

