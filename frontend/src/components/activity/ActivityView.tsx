import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Info,
  Search,
  Download,
  FileText,
  FileCode,
  ChevronDown,
} from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation';

export const ActivityView: React.FC = () => {
  const { activities } = useApp();
  const { t, language } = useTranslation();
  const [filterQuery, setFilterQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'success' | 'warning' | 'danger' | 'info'>('all');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'danger':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const filtered = activities.filter((act) => {
    const q = filterQuery.toLowerCase();
    const matchesSearch =
      act.action.toLowerCase().includes(q) ||
      act.actor.toLowerCase().includes(q) ||
      act.target.toLowerCase().includes(q) ||
      (act.ip && act.ip.toLowerCase().includes(q)) ||
      (act.details && act.details.toLowerCase().includes(q));
    const matchesSev = severityFilter === 'all' ? true : act.severity === severityFilter;
    return matchesSearch && matchesSev;
  });

  const exportLogs = (format: 'csv' | 'json', scope: 'filtered' | 'all') => {
    const list = scope === 'filtered' ? filtered : activities;
    const records = list.map((act) => ({
      timestamp: act.rawTimestamp || act.timestamp,
      user: act.actor,
      ip_address: act.ip || '127.0.0.1',
      action: act.action,
      description: act.details || act.target || (language === 'de' ? 'Aktion ausgeführt' : 'Action executed'),
    }));

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `audit-logs-${scope}-${dateStr}.${format}`;

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
      // Standard RFC-4180 CSV Export
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

    setExportMenuOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            {language === 'de' ? 'Aktivitäts- & Audit-Protokoll' : 'Activity & Audit Logs'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {language === 'de'
              ? 'Unveränderlicher Audit-Trail für Cluster-Events, administrative Aktionen und Statuswechsel.'
              : 'Immutable cluster event trail, administrative signals, and lifecycle changes.'}
          </p>
        </div>

        {/* Export Buttons */}
        <div className="relative flex items-center gap-2">
          {/* Quick CSV Export */}
          <button
            onClick={() => exportLogs('csv', filterQuery || severityFilter !== 'all' ? 'filtered' : 'all')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-200 hover:text-white border border-[#30363d] text-xs font-medium transition-colors cursor-pointer"
            title={language === 'de' ? 'Aktuelle Ansicht als CSV herunterladen' : 'Download current view as CSV'}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV {language === 'de' ? 'Export' : 'Export'}</span>
          </button>

          {/* Quick JSON Export */}
          <button
            onClick={() => exportLogs('json', filterQuery || severityFilter !== 'all' ? 'filtered' : 'all')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-200 hover:text-white border border-[#30363d] text-xs font-medium transition-colors cursor-pointer"
            title={language === 'de' ? 'Aktuelle Ansicht als JSON herunterladen' : 'Download current view as JSON'}
          >
            <FileCode className="w-3.5 h-3.5 text-sky-400" />
            <span>JSON {language === 'de' ? 'Export' : 'Export'}</span>
          </button>

          {/* Detailed Export Menu Toggle */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="p-1.5 rounded-lg bg-[#21262d] hover:bg-[#30363d] text-slate-300 hover:text-white border border-[#30363d] text-xs transition-colors cursor-pointer"
              title={language === 'de' ? 'Weitere Export-Optionen' : 'More export options'}
            >
              <ChevronDown className="w-4 h-4" />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-[#161b22] border border-[#30363d] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                  {language === 'de' ? 'Export auswählen' : 'Select Export'}
                </div>
                <div className="divide-y divide-[#30363d]/60 text-xs">
                  <div className="py-1">
                    <button
                      onClick={() => exportLogs('csv', 'filtered')}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-slate-200 hover:bg-[#21262d] rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        <span>CSV ({language === 'de' ? 'Gefiltert' : 'Filtered'})</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{filtered.length}</span>
                    </button>
                    <button
                      onClick={() => exportLogs('csv', 'all')}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-slate-200 hover:bg-[#21262d] rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        <span>CSV ({language === 'de' ? 'Alle Logs' : 'All Logs'})</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{activities.length}</span>
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => exportLogs('json', 'filtered')}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-slate-200 hover:bg-[#21262d] rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FileCode className="w-3.5 h-3.5 text-sky-400" />
                        <span>JSON ({language === 'de' ? 'Gefiltert' : 'Filtered'})</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{filtered.length}</span>
                    </button>
                    <button
                      onClick={() => exportLogs('json', 'all')}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-slate-200 hover:bg-[#21262d] rounded-lg transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FileCode className="w-3.5 h-3.5 text-sky-400" />
                        <span>JSON ({language === 'de' ? 'Alle Logs' : 'All Logs'})</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">{activities.length}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={
              language === 'de'
                ? 'Audit-Trail nach Akteur, Aktion, IP oder Details durchsuchen...'
                : 'Search audit trail by actor, action, IP, or details...'
            }
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-zinc-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['all', 'success', 'warning', 'danger', 'info'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors cursor-pointer ${
                severityFilter === sev
                  ? 'bg-[#21262d] text-white border border-[#30363d]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#161b22] text-slate-400 border-b border-[#30363d] font-medium">
              <tr>
                <th className="py-3 px-4 w-12">Level</th>
                <th className="py-3 px-4">{language === 'de' ? 'Aktion' : 'Action'}</th>
                <th className="py-3 px-4">{language === 'de' ? 'Benutzer' : 'User'}</th>
                <th className="py-3 px-4">{language === 'de' ? 'Ziel / Beschreibung' : 'Target / Description'}</th>
                <th className="py-3 px-4">{language === 'de' ? 'IP-Adresse' : 'IP Address'}</th>
                <th className="py-3 px-4 text-right">{language === 'de' ? 'Zeitstempel' : 'Timestamp'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]/70">
              {filtered.map((act) => (
                <tr key={act.id} className="hover:bg-[#1c2128] transition-colors">
                  <td className="py-3 px-4">
                    <div className="p-1 rounded bg-[#0d1117] border border-[#30363d] w-fit">
                      {getSeverityIcon(act.severity)}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-white">{act.action}</span>
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-300">
                    {act.actor}
                  </td>
                  <td className="py-3 px-4 text-slate-300 max-w-xs truncate" title={act.details || act.target}>
                    {act.details || act.target}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                    {act.ip || '127.0.0.1'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {act.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <p className="text-sm font-medium">
              {language === 'de' ? 'Keine Einträge entsprechen dem Filter' : 'No activity items match your filter'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
