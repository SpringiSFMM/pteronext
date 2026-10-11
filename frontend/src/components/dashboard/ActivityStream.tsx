import React from 'react';
import { useApp } from '../../context/AppContext';
import { Activity, AlertCircle, Info, CheckCircle2, Shield, ArrowUpRight } from 'lucide-react';

export const ActivityStream: React.FC = () => {
  const { activities, setActiveView } = useApp();

  const getSeverityIcon = (sev: string) => {
    switch (sev) {
      case 'success':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
      case 'warning':
        return <AlertCircle className="w-3.5 h-3.5 text-amber-400" />;
      case 'danger':
        return <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
      default:
        return <Info className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'success':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      case 'warning':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      case 'danger':
        return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
      default:
        return 'border-sky-500/30 bg-sky-500/10 text-sky-400';
    }
  };

  return (
    <div
      id="activity-stream-section"
      className="glass-panel rounded-2xl p-5 border border-slate-800/80 shadow-xl space-y-4"
    >
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-sm">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                Cluster Audit Trail
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Live Security Log
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Real-time audit log of user & cluster operations
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveView('activity')}
          className="text-xs font-mono font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1 hover:underline"
        >
          <span>Full Audit</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="py-8 text-center bg-[#0d1117]/80 rounded-xl border border-slate-800/60 p-5 space-y-2">
          <Shield className="w-6 h-6 text-slate-500 mx-auto" />
          <p className="text-xs font-semibold text-slate-300">No recent audit activity</p>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
            Server lifecycle events, power changes, and administrative actions will appear here in real-time.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 relative before:absolute before:inset-y-2 before:left-[17px] before:w-0.5 before:bg-slate-800/60">
          {activities.slice(0, 5).map((act) => (
            <div
              key={act.id}
              className="flex items-start gap-3.5 p-3 rounded-xl bg-[#0d1117]/80 border border-slate-800/80 hover:border-slate-700 transition-all relative z-10 glass-card-interactive"
            >
              <div
                className={`p-1.5 rounded-xl border shrink-0 mt-0.5 shadow-sm ${getSeverityBadge(
                  act.severity
                )}`}
              >
                {getSeverityIcon(act.severity)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate font-sans">
                    {act.action}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500 shrink-0">
                    {act.timestamp}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                  <span className="text-indigo-400 font-semibold bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 text-[10px]">
                    {act.actor}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-300 truncate">{act.target}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
