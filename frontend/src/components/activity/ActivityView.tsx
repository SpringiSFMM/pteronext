import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Activity, CheckCircle2, AlertCircle, Info, Search, Filter } from 'lucide-react';

export const ActivityView: React.FC = () => {
  const { activities } = useApp();
  const [filterQuery, setFilterQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'success' | 'warning' | 'danger' | 'info'>('all');

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
    const matchesSearch =
      act.action.toLowerCase().includes(filterQuery.toLowerCase()) ||
      act.actor.toLowerCase().includes(filterQuery.toLowerCase()) ||
      act.target.toLowerCase().includes(filterQuery.toLowerCase());
    const matchesSev = severityFilter === 'all' ? true : act.severity === severityFilter;
    return matchesSearch && matchesSev;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#30363d]/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Activity & Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Immutable cluster event trail, administrative signals, and lifecycle changes.
          </p>
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search audit trail by actor, action, or target..."
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
              className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
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
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Instance</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
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
                  <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                    {act.target}
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
            <p className="text-sm font-medium">No activity items match your filter</p>
          </div>
        )}
      </div>
    </div>
  );
};
